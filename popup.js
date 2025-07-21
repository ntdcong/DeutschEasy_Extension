async function getSelectionFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString()
  });
  return result.trim() || "Haus";
}

async function fetchNounInfo(word) {
  try {
    const res = await fetch(`https://www.verbformen.com/?w=${encodeURIComponent(word)}`);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const mainBlock = doc.querySelector('.rAufZu');
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><h3 style="margin-bottom:0.5em;display:inline">Danh từ tiếng Đức</h3><a id="gotoSource" href="https://www.verbformen.com/?w=${encodeURIComponent(word)}" target="_blank" style="font-size:1.2em;text-decoration:none;" title="Xem trên trang gốc">🔗</a></div>`;

    if (mainBlock) {
      mainBlock.querySelectorAll('img').forEach(img => {
        if (img.src.startsWith('http')) return;
        img.src = 'https://www.verbformen.com' + img.getAttribute('src');
      });

      // Tạo khối HTML
      const wordBlock = mainBlock.querySelector('.vGrnd');
      const meaningBlock = mainBlock.querySelector('span[lang="en"]')?.parentElement;
      const extraMeaning = mainBlock.querySelector('.rInf i');
      const exampleBlock = mainBlock.querySelector('.rNt');

      let html = '';
      if (wordBlock) {
        // Lấy text bên trong .vGrnd
        const vGrndText = wordBlock.textContent.trim();
        // Tách giống và danh từ
        const match = vGrndText.match(/^(der|die|das)\s+(.*)$/i);
        if (match) {
          let color = '#222';
          if (match[1].toLowerCase() === 'das') color = '#2ecc40';
          if (match[1].toLowerCase() === 'der') color = '#0074d9';
          if (match[1].toLowerCase() === 'die') color = '#ff4136';
          // Bỏ ảnh loa khỏi HTML gốc
          let nounHtml = wordBlock.innerHTML.replace(/<img[^>]*s\.svg[^>]*>/g, '');
          // Bỏ từ loại cũ khỏi HTML gốc
          nounHtml = nounHtml.replace(/^(der|die|das)\s+/i, '');
          // Bỏ thẻ <i> nếu có
          nounHtml = nounHtml.replace(/<i>(.*?)<\/i>/g, '$1');
          // Tạo HTML mới: chỉ phóng to danh từ, không nghiêng, không phóng to giống
          html += `<div style="margin-bottom:0.5em">
            <span style="color:${color};font-weight:bold;font-size:2em;">${match[1]}</span>
            <span style="font-size:2em; font-weight:bold;"> ${nounHtml.trim()}</span>
          </div>`;
        } else {
          // fallback: vẫn bỏ ảnh loa, không tô màu
          let wordHtml = wordBlock.outerHTML.replace(/<img[^>]*s\.svg[^>]*>/g, '');
          html += `<div style="font-size:1.2em;margin-bottom:0.5em">${wordHtml}</div>`;
        }
      }
      if (meaningBlock) html += `<div style="margin-bottom:0.5em">${meaningBlock.outerHTML}</div>`;
      if (extraMeaning) html += `<div style="color:#555;margin-bottom:0.5em"><i>${extraMeaning.textContent}</i></div>`;
      if (exampleBlock) html += `<div style="color:#444">${exampleBlock.outerHTML}</div>`;

      resultDiv.innerHTML += html || '<div class="error">Không tìm thấy thông tin cần thiết.</div>';

      // Lấy phần bảng biến cách (declension table)
      const declensionSections = doc.querySelectorAll('section.rBox.rBoxWht');
      let declensionSection = null;
      for (const sec of declensionSections) {
        if (sec.querySelector('.vDkl')) {
          declensionSection = sec;
          break;
        }
      }
      if (declensionSection) {
        // Lấy phần tiêu đề bảng
        const declTitle = declensionSection.querySelector('header p.rInf')?.outerHTML || '';
        // Lấy phần bảng
        const declTableBlock = declensionSection.querySelector('.vDkl');
        // Loại bỏ ảnh loa trong bảng
        if (declTableBlock) {
          declTableBlock.querySelectorAll('img').forEach(img => {
            if (img.src && img.src.includes('s.svg')) {
              img.remove();
            } else if (img.src && !img.src.startsWith('http')) {
              img.src = 'https://www.verbformen.com' + img.getAttribute('src');
            }
          });
        }
        const declTable = declTableBlock?.outerHTML || '';
        // Tạo nút xem bảng
        const btnId = 'showDeclBtn';
        const declId = 'declTableBlock';
        resultDiv.innerHTML += `<button id="${btnId}" style="margin:8px 0;padding:4px 12px;font-size:1em;cursor:pointer;">Xem bảng biến cách</button><div id="${declId}" style="display:none;margin-top:8px;">${declTitle}${declTable}</div>`;
        // Thêm sự kiện cho nút
        setTimeout(() => {
          const btn = document.getElementById(btnId);
          const block = document.getElementById(declId);
          if (btn && block) {
            btn.onclick = () => {
              block.style.display = block.style.display === 'none' ? 'block' : 'none';
              btn.textContent = block.style.display === 'none' ? 'Xem bảng biến cách' : 'Ẩn bảng biến cách';
            };
          }
        }, 100);
      }

      // Lấy phần động từ (conjugation table)
      let verbSection = null;
      let maxTblCount = 0;
      for (const sec of declensionSections) {
        const tbls = sec.querySelectorAll('.vTbl');
        if (tbls.length > maxTblCount) {
          maxTblCount = tbls.length;
          verbSection = sec;
        }
      }
      if (verbSection && maxTblCount >= 2) { // chỉ lấy nếu có ít nhất 2 bảng (tránh nhầm với bảng biến cách)
        // Lấy tiêu đề động từ
        const verbTitle = verbSection.querySelector('header p.rInf')?.outerHTML || '';
        // Lấy tất cả các bảng động từ
        const verbTables = verbSection.querySelectorAll('.vTbl');
        let verbTablesHtml = '';
        verbTables.forEach(tbl => {
          // Loại bỏ ảnh loa trong bảng động từ
          tbl.querySelectorAll('img').forEach(img => {
            if (img.src && img.src.includes('s.svg')) {
              img.remove();
            } else if (img.src && !img.src.startsWith('http')) {
              img.src = 'https://www.verbformen.com' + img.getAttribute('src');
            }
          });
          verbTablesHtml += tbl.outerHTML;
        });
        // Tạo nút xem bảng động từ
        const verbBtnId = 'showVerbBtn';
        const verbBlockId = 'verbTableBlock';
        resultDiv.innerHTML += `<button id="${verbBtnId}" style="margin:8px 0;padding:4px 12px;font-size:1em;cursor:pointer;">Xem bảng động từ</button><div id="${verbBlockId}" style="display:none;margin-top:8px;">${verbTitle}${verbTablesHtml}</div>`;
        // Thêm sự kiện cho nút
        setTimeout(() => {
          const btn = document.getElementById(verbBtnId);
          const block = document.getElementById(verbBlockId);
          if (btn && block) {
            btn.onclick = () => {
              block.style.display = block.style.display === 'none' ? 'block' : 'none';
              btn.textContent = block.style.display === 'none' ? 'Xem bảng động từ' : 'Ẩn bảng động từ';
            };
          }
        }, 100);
      }
    } else {
      resultDiv.innerHTML += `<div class="error">Không tìm thấy thông tin danh từ.</div>`;
    }
  } catch (err) {
    document.getElementById("result").innerHTML = `<div class="error">Lỗi khi lấy dữ liệu.</div>`;
  }
}

getSelectionFromActiveTab().then(fetchNounInfo);
