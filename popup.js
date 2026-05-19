const textarea  = document.getElementById('pasteInput');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const openBtn   = document.getElementById('openReader');

function updateStats() {
  const text  = textarea.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCount.textContent = words.toLocaleString();
  charCount.textContent = textarea.value.length.toLocaleString();
  openBtn.disabled = words === 0;
}

textarea.addEventListener('input', updateStats);

openBtn.addEventListener('click', () => {
  const text = textarea.value.trim();
  if (!text) return;

  chrome.storage.local.set({ pendingText: text }, () => {
    const width  = 680;
    const height = 780;
    chrome.windows.create({
      url: chrome.runtime.getURL('reader.html'),
      type: 'popup',
      width,
      height,
      focused: true,
    });
    window.close();
  });
});
