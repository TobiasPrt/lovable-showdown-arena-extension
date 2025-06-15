// background.js - Service Worker

let originalInitiatorTabId = null; // To store the ID of the tab that sent RUN_PROMPT

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_PROMPT') {
    const prompt = message.prompt;
    originalInitiatorTabId = sender.tab?.id;

    if (!originalInitiatorTabId) {
      console.error('RUN_PROMPT: Could not get sender tab ID. Aborting.');
      return true; // Indicate async response potentially, though none sent here for error
    }

    console.log('RUN_PROMPT received from tab:', originalInitiatorTabId, 'Prompt:', prompt);

    const modelsToProcess = ['Google', 'OpenAI', 'Anthropic'];
    modelsToProcess.forEach((model) => {
      chrome.tabs.create({ url: 'https://lovable.dev/', active: false }, (newTab) => {
        if (!chrome.runtime.id) {
          console.warn(`Context invalidated after tab creation for ${model}, before onUpdated listener setup.`);
          return;
        }
        console.log(`Opened ${model} tab with ID: ${newTab.id}`);
        // Storing tabId associated with model might be useful if you need to reference it later,
        // but for this listener pattern, newTab.id is directly available in this scope.

        const listenerCallback = function(tabId, changeInfo, tab) {
          if (!chrome.runtime.id) {
            console.warn(`Context invalidated for onUpdated listener for tab ${tabId} (${model}). Removing listener.`);
            chrome.tabs.onUpdated.removeListener(listenerCallback); // Attempt to remove self
            return;
          }

          if (tabId === newTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listenerCallback);
            console.log(`Tab ${newTab.id} (${model}) loaded. Sending INJECT_PROMPT.`);
            chrome.tabs.sendMessage(newTab.id, { 
              type: 'INJECT_PROMPT', 
              prompt: prompt, 
              model: model, 
              originalInitiatorTabId: originalInitiatorTabId 
            })
              .catch(error => {
                if (!chrome.runtime.id) {
                  console.warn(`Context invalidated while trying to send INJECT_PROMPT to tab ${newTab.id} (${model}).`);
                } else {
                  console.error(`Error sending INJECT_PROMPT to tab ${newTab.id} (${model}):`, error);
                }
              });
          }
        };
        chrome.tabs.onUpdated.addListener(listenerCallback);
      });
    });
  }

  if (message.type === 'IFRAME_HTML_RESULT') {
    const targetTabId = message.originalInitiatorTabId; 
    if (targetTabId) {
      console.log(`IFRAME_HTML_RESULT: Forwarding to original tab ${targetTabId}, Model: ${message.model}`);
      chrome.tabs.sendMessage(targetTabId, {
        type: 'IFRAME_HTML_RESULT',
        html: message.html,
        model: message.model
      })
      .then(response => {
        if (!chrome.runtime.id) return;
        console.log(`Successfully sent IFRAME_HTML_RESULT to tab ${targetTabId} for model ${message.model}`);
      })
      .catch(error => {
        if (!chrome.runtime.id) {
          console.warn(`Context invalidated while trying to send IFRAME_HTML_RESULT to tab ${targetTabId} for model ${message.model}.`);
        } else {
          console.error(`Error sending IFRAME_HTML_RESULT to tab ${targetTabId} for model ${message.model}:`, error);
        }
      });
    } else {
      console.error('IFRAME_HTML_RESULT: message.originalInitiatorTabId is not set. Cannot forward.');
    }
  }

  if (message.type === 'IFRAME_ERROR') { 
    const targetTabId = message.originalInitiatorTabId; 
    if (targetTabId) {
      console.log(`IFRAME_ERROR: Forwarding error to original tab ${targetTabId}, Model: ${message.model}, Error: ${message.error}`);
      chrome.tabs.sendMessage(targetTabId, {
        type: 'IFRAME_ERROR_DISPLAY', 
        error: message.error,
        model: message.model
      })
      .then(response => {
        if (!chrome.runtime.id) return;
        console.log(`Successfully sent IFRAME_ERROR_DISPLAY to tab ${targetTabId} for model ${message.model}`);
      })
      .catch(error => {
        if (!chrome.runtime.id) {
          console.warn(`Context invalidated while trying to send IFRAME_ERROR_DISPLAY to tab ${targetTabId} for model ${message.model}.`);
        } else {
          console.error(`Error sending IFRAME_ERROR_DISPLAY to tab ${targetTabId} for model ${message.model}:`, error);
        }
      });
    } else {
      console.error('IFRAME_ERROR: message.originalInitiatorTabId is not set. Cannot forward error.');
    }
  }
  return false; 
});

// Your getActiveTabId function can remain if you need it for other purposes.
// It's not directly used in the corrected flow above for this specific problem.
function getActiveTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError.message);
      }
      if (!tabs || tabs.length === 0) {
        return reject('No active tab found');
      }
      resolve(tabs[0].id);
    });
  });
}