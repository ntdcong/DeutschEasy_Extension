
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lookup-noun",
    title: "Tra danh từ tiếng Đức",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lookup-noun") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fetchVerbformenData,
      args: [info.selectionText]
    });
  }
});

function fetchVerbformenData(selectedWord) {
  const url = `https://www.verbformen.de/deklination/substantive/${selectedWord}.htm`;

  fetch(url)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const content = doc.querySelector("#vStckInf");
      if (content) {
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.top = "10px";
        container.style.right = "10px";
        container.style.zIndex = "999999";
        container.style.background = "white";
        container.style.border = "1px solid #ccc";
        container.style.padding = "10px";
        container.style.maxWidth = "400px";
        container.style.overflowY = "auto";
        container.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
        container.innerHTML = content.outerHTML;

        document.body.appendChild(container);
      } else {
        alert("Không tìm thấy từ hoặc không phải danh từ.");
      }
    })
    .catch(err => {
      alert("Không thể lấy dữ liệu.");
      console.error(err);
    });
}
