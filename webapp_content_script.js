console.log("Webapp content script loaded.");

const banner = document.querySelector('#browser-extension-banner');
if (banner) {
  banner.style.display = 'none';
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'LOVABLE_PROMPT') {
    console.log("Content script (lovable.dev): Received message from page (window.postMessage):", event.data);
    const prompt = event.data.prompt;
    const model = event.data.model;
    chrome.runtime.sendMessage({ type: 'RUN_PROMPT', prompt, model });
    return;
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'IFRAME_HTML_RESULT') {
    const iframeTagString = message.html;
    const model = message.model;
    console.log(`Webapp: Received iframe tag for model ${model}:`, iframeTagString);

    let targetContainerDiv;
    let loadingIndicator;

    if (model === 'OpenAI') {
      targetContainerDiv = document.querySelector('#result-box-openai > div:nth-child(2)');
      loadingIndicator = document.querySelector('#loading-indicator-openai');
      loadingIndicator.style.display = 'none';
    } else if (model === 'Google') {
      targetContainerDiv = document.querySelector('#result-box-google > div:nth-child(2)');
      loadingIndicator = document.querySelector('#loading-indicator-google');
      loadingIndicator.style.display = 'none';
    } else if (model === 'Anthropic') {
      targetContainerDiv = document.querySelector('#result-box-anthropic > div:nth-child(2)');
      loadingIndicator = document.querySelector('#loading-indicator-anthropic');
      loadingIndicator.style.display = 'none';
    } else {
      console.error(`Webapp: Unknown model received: ${model}`);
      return;
    }

    if (targetContainerDiv) {
      targetContainerDiv.innerHTML = iframeTagString;

      // Optional: Style the actual iframe element if needed, now that it's in the DOM
      const newIframe = targetContainerDiv.querySelector('iframe');
      if (newIframe) {
        newIframe.style.width = '100%';
        newIframe.style.height = '100%'; // Make iframe fill its wrapper
        newIframe.style.border = 'none';
        console.log(`Webapp: Iframe for ${model} injected into #${targetContainerDiv.id} and styled.`);
      } else {
        console.error(`Webapp: Could not find the iframe within #${targetContainerDiv.id} after injection.`);
      }
    } else {
      console.error(`Webapp: Target container div not found for model ${model}.`);
    }
  }
}); 