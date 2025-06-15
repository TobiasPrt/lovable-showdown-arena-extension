console.log("Lovable content script loaded.");

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // No need to check event.source, this is for chrome.runtime messages

  if (message.type === 'INJECT_PROMPT') {
    const prompt = message.prompt;
    const model = message.model;
    const originalInitiatorTabId = message.originalInitiatorTabId;

    console.log("Content script: Received INJECT_PROMPT", { prompt, model, originalInitiatorTabId });

    if (!originalInitiatorTabId) {
      console.error("Content script: originalInitiatorTabId is missing in INJECT_PROMPT. Cannot proceed reliably.");
      return; // Or send an error response
    }

    try {
      const chatInput = await waitForElement('#chatinput');
      console.log("Content script: #chatinput found.");
      insertPrompt(chatInput, prompt);

      // Wait for the submit button to be available
      const submitButton = await waitForElement('#chatinput-send-message-button');
      

      console.log("Waiting 2 seconds before attempting to submit...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay

      console.log("Content script: #chatinput-send-message-button found.");
      
      await selectModel(model);

      console.log("Content script: Model selected.");

      await new Promise(resolve => setTimeout(resolve, 1000));

      submitPrompt(submitButton);
      console.log("Content script: Submit button clicked.");

      console.log("Waiting for preview panel iframe element...");
      const iframeElement = await waitForPreview(); // waitForPreview now resolves with the element
      console.log("Content script: Preview panel iframe element found.");
      const iframeTagHtml = iframeElement.outerHTML;
      console.log("Content script: Preview found, iframe HTML:", iframeTagHtml);

      // Send the iframe HTML back to the background script
      chrome.runtime.sendMessage({
        type: 'IFRAME_HTML_RESULT',
        html: iframeTagHtml,
        model: model,
        originalInitiatorTabId: originalInitiatorTabId
      });
    } catch (error) {
      console.error("Content script: Error during prompt injection or preview waiting:", error);
      // Optionally, send an error message back to background or original tab
      chrome.runtime.sendMessage({
        type: 'IFRAME_ERROR',
        error: error.message,
        model: model,
        originalInitiatorTabId: originalInitiatorTabId
      });
    }
  }
});

function findPreviousButton(targetId) {
    const target = document.querySelector(targetId);
    if (!target) {
      console.log(`findPreviousButton: No element found with id: ${targetId}`);
      return null;
    }

    // Search for the first button in the parent element
    const parent = target.parentElement.parentElement;
    if (!parent) {
      console.log(`findPreviousButton: No parent element found for target with id: ${targetId}`);
      return null;
    }

    // Search for the first button in the parent element
    const buttonInParent = parent.querySelector('button');
    if (buttonInParent) {
      console.log('findPreviousButton: Found button in parent');
      return buttonInParent;
    }

    console.log('findPreviousButton: No button found in parent');
    return null; // no button found
  }
  
async function selectModel(model) {
    const button = document.querySelector('#radix-\\:rb\\:');
    button.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    button.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    button.dispatchEvent(new PointerEvent('pointerclick', {bubbles: true}));
    // wait 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("Content script: Selecting model: " + model);

    const modelItem = Array.from(document.querySelectorAll('#radix-\\:rc\\: div[role="menuitemradio"]')).find(div =>
      div.textContent.includes(model)
    );
    if (!modelItem) {
      console.error("Content script: Model item not found: " + model);
      return;
    }
    console.log("Content script: Model item found: " + modelItem);

    modelItem.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    modelItem.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    modelItem.dispatchEvent(new PointerEvent('pointerclick', {bubbles: true}));
    modelItem.click();
}
// Wait for an element to appear in the DOM
function waitForElement(selector) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect(); // Stop observing
        resolve(el);
      }
    });

    // Start observing the document body for changes
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Optional: Timeout to prevent indefinite waiting
    setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
    }, 10000); // 10 seconds timeout
  });
}

// Injects the prompt into the given textfield element
function insertPrompt(textfieldElement, prompt) {
    if (!textfieldElement) {
      // This check might be redundant if waitForElement works correctly
      // but kept for safety, or if insertPrompt is called directly elsewhere.
      throw new Error(`Textfield element not provided for inserting prompt.`);
    }
    textfieldElement.value = prompt;
    // Dispatch input event to ensure any framework listeners are triggered
    textfieldElement.dispatchEvent(new Event('input', { bubbles: true }));
    textfieldElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// Submits the prompt using the given button element
function submitPrompt(buttonElement) {
    if (!buttonElement) {
      throw new Error('Submit button element not provided.');
    }

    console.log("Attempting to submit via form submission...");

    // This is often more reliable for form buttons.
    if (buttonElement.form) {
      console.log("Button is part of a form. Attempting form.requestSubmit().");
      try {
        buttonElement.form.requestSubmit(buttonElement); // Pass the button that initiated submission
        console.log("Form submission requested.");
      } catch (e) {
        console.error("Error during form.requestSubmit():", e);
      }
    } else {
       console.warn("Button does not appear to be part of a form. The click events above are the primary attempt.");
    }
}

function waitForPreview(stabilizationDelayMs = 2000) { // Default stabilization delay of 2 seconds
    return new Promise((resolve, reject) => {
        let elementObserver; // Declare here
        let attributeObserver; // Declare here

        const checkSrcAndResolve = (iframeEl) => {
            const currentSrc = iframeEl.getAttribute('src');
            if (currentSrc && currentSrc.trim() !== '' && currentSrc !== 'about:blank') {
                console.log(`waitForPreview: iframe #live-preview-panel has valid src: "${currentSrc}". Waiting ${stabilizationDelayMs}ms for stabilization.`);
                if (attributeObserver) {
                    attributeObserver.disconnect();
                }
                // Element observer should already be disconnected if we are here from its callback
                // or if the element was found initially.
                if (elementObserver && iframeEl === document.querySelector('#live-preview-panel')) {
                    elementObserver.disconnect();
                }

                setTimeout(() => {
                    const finalIframeElement = document.querySelector('#live-preview-panel'); // Re-query in case of DOM changes
                    if (finalIframeElement && finalIframeElement.getAttribute('src') === currentSrc) { // Ensure src hasn't changed during stabilization
                        console.log("waitForPreview: Stabilization complete. Resolving with iframe element.");
                        resolve(finalIframeElement);
                    } else {
                        console.warn("waitForPreview: iframe src changed or element disappeared during stabilization. Restarting wait for src on existing or new element.");
                        // Instead of rejecting, we could try to re-initiate the observation or a part of it.
                        // For now, let's disconnect any remaining observers and reject to avoid infinite loops on rapidly changing src.
                        // However, per user request to remove timeouts, we will not reject here.
                        // If the element is gone, the elementObserver part will handle it if it's re-engaged.
                        // If src changed, attribute observer would pick it up if re-engaged.
                        // This state implies something is very unstable. For now, we'll log and the promise will hang if it can't re-stabilize.
                        // To truly remove all failure paths, we'd need a more complex loop here.
                        // For now, let's assume the stabilization delay is usually enough.
                        // If the element is gone, the original elementObserver logic should ideally re-trigger if we re-call waitForElement.
                        // This part becomes tricky without a timeout. Let's just resolve if it was stable.
                        // If it's not stable, the original problem was that it would timeout. Now it won't.
                        // The risk is an infinite loop if src keeps changing *after* being valid once and *before* stabilization completes.
                        // Let's proceed with resolving, assuming stabilization means it's good enough.
                        if (finalIframeElement) {
                             console.log("waitForPreview: Stabilization complete (src might have changed but element exists). Resolving with current iframe element.");
                             resolve(finalIframeElement); // Resolve with the element as it is after delay
                        } else {
                            console.error("waitForPreview: iframe element disappeared during stabilization. The promise will hang as per no-timeout request.");
                            // No reject() here to honor no-timeout request. The promise will not resolve.
                        }
                    }
                }, stabilizationDelayMs);
            } else {
                console.log(`waitForPreview: iframe #live-preview-panel found, but src is still invalid (empty, blank, or not yet set). Current src: "${currentSrc || 'null'}". Waiting for src to be set...`);
                // If src is not valid, attributeObserver should still be running if iframeEl exists.
                // If iframeEl was just found, and src is invalid, attributeObserver will be set up right after this.
            }
        };

        const setupAttributeObserver = (iframeEl) => {
            if (attributeObserver) {
                attributeObserver.disconnect(); // Disconnect previous if any
            }
            attributeObserver = new MutationObserver((mutationsList, obs) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                        console.log("waitForPreview: 'src' attribute change detected on iframe.");
                        checkSrcAndResolve(iframeEl); // Check if the new src is valid
                    }
                }
            });
            attributeObserver.observe(iframeEl, { attributes: true });
            console.log("waitForPreview: Attribute observer set up for #live-preview-panel 'src'.");
        };

        const iframe = document.querySelector('#live-preview-panel');
        if (iframe) {
            console.log("waitForPreview: iframe #live-preview-panel found immediately.");
            checkSrcAndResolve(iframe); // Check its src immediately
            if (!iframe.getAttribute('src') || iframe.getAttribute('src') === 'about:blank' || iframe.getAttribute('src').trim() === '') {
                console.log("waitForPreview: Initial src is invalid, setting up attribute observer.");
                setupAttributeObserver(iframe);
            }
        } else {
            console.log("waitForPreview: iframe #live-preview-panel not found immediately. Setting up element observer.");
            if (elementObserver) elementObserver.disconnect(); // Clear any previous
            elementObserver = new MutationObserver((mutationsList, obs) => {
                const panelIframe = document.querySelector('#live-preview-panel');
                if (panelIframe) {
                    console.log("waitForPreview: iframe #live-preview-panel appeared in DOM.");
                    obs.disconnect(); // Stop observing for the element itself
                    console.log("waitForPreview: Disconnected elementObserver.");
                    checkSrcAndResolve(panelIframe); // Check its src
                    if (!panelIframe.getAttribute('src') || panelIframe.getAttribute('src') === 'about:blank' || panelIframe.getAttribute('src').trim() === '') {
                        console.log("waitForPreview: Appeared iframe's src is invalid, setting up attribute observer.");
                        setupAttributeObserver(panelIframe);
                    }
                }
            });
            elementObserver.observe(document.documentElement, { childList: true, subtree: true });
            console.log("waitForPreview: Element observer set up for #live-preview-panel.");
        }
    });
}

function extractAndSendIframeTagHtml(iframeElement, model, originalInitiatorTabId) {
    if (!iframeElement) {
      console.error("extractAndSendIframeTagHtml: iframeElement is null or undefined.");
      return;
    }
    const iframeTagHtml = iframeElement.outerHTML;
    console.log("Sending iframe tag HTML:", iframeTagHtml);
    chrome.runtime.sendMessage({
      type: "IFRAME_HTML_RESULT",
      html: iframeTagHtml, // This is the string like "<iframe src='...'></iframe>"
      model: model,
      originalInitiatorTabId: originalInitiatorTabId
    });
}