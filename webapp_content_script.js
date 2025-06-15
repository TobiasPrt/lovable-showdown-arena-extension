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
    let iframeWrapperId;
    let loadingIndicator;

    if (model === 'OpenAI') {
      targetContainerDiv = document.querySelector('#result-box-openai > div');
      loadingIndicator = document.querySelector('#loading-indicator-openai');
      loadingIndicator.style.display = 'none';
      iframeWrapperId = 'lovable-ext-wrapper-openai';
    } else if (model === 'Google') {
      targetContainerDiv = document.querySelector('#result-box-google > div');
      loadingIndicator = document.querySelector('#loading-indicator-google');
      loadingIndicator.style.display = 'none';
      iframeWrapperId = 'lovable-ext-wrapper-google';
    } else if (model === 'Anthropic') {
      targetContainerDiv = document.querySelector('#result-box-anthropic > div');
      loadingIndicator = document.querySelector('#loading-indicator-anthropic');
      loadingIndicator.style.display = 'none';
      iframeWrapperId = 'lovable-ext-wrapper-anthropic';
    } else {
      console.error(`Webapp: Unknown model received: ${model}`);
      return;
    }

    if (targetContainerDiv) {
      // Remove any existing wrapper for this model (e.g., from a previous run)
      const existingWrapper = targetContainerDiv.querySelector(`#${iframeWrapperId}`);
      if (existingWrapper) {
        existingWrapper.remove();
      }

      // Create a new wrapper div for our iframe
      const iframeWrapper = targetContainerDiv.querySelector('div:nth-child(2)');
      if (!iframeWrapper) {
        console.error(`Webapp: Could not find the second div inside the target container for model ${model}`);
        return;
      }
      iframeWrapper.id = iframeWrapperId;
      iframeWrapper.style.width = '100%';
      iframeWrapper.style.height = '100%'; // Or match parent, or specific size
      
      // Insert the iframe string into our new wrapper
      iframeWrapper.innerHTML = iframeTagString; 

      // Append our wrapper to the target website's container
      targetContainerDiv.appendChild(iframeWrapper);

      // Optional: Style the actual iframe element if needed, now that it's in the DOM
      const newIframe = iframeWrapper.querySelector('iframe');
      if (newIframe) {
        newIframe.style.width = '100%';
        newIframe.style.height = '100%'; // Make iframe fill its wrapper
        newIframe.style.border = 'none';
        console.log(`Webapp: Iframe for ${model} injected into #${iframeWrapperId} and styled.`);
      } else {
        console.error(`Webapp: Could not find the iframe within #${iframeWrapperId} after injection.`);
      }
    } else {
      console.error(`Webapp: Target container div not found for model ${model}.`);
    }
  }
}); 