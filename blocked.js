document.querySelector('#manage-blocking').addEventListener('click', async () => {
  try {
    await chrome.runtime.openOptionsPage();
  } catch (error) {
    document.querySelector('#error').textContent = `Could not open settings. ${error.message}`;
  }
});
