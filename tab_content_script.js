// tab_content_script.js (injected into AI tool tabs like OpenAI, Anthropic, Google workspaces)

// Guard to ensure the script runs only once per page context
if (typeof window.tabScriptProcessed === 'undefined') {
  window.tabScriptProcessed = true; // Mark as processed for this context

  console.log("Tab Content Script: Loaded and waiting for prompt.");

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PROCESS_PAGE_WITH_PROMPT") {
      console.log("Tab Content Script: Received prompt:", message.prompt);
      const { prompt, originalLovableDevTabId } = message;

      async function processPageActions() {
        try {
          // 1. Wait for the page to be fully loaded.
          // Content scripts often run at document_idle, but 'load' ensures images, etc., are ready.
          await new Promise(resolve => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve, { once: true });
            }
          });
          console.log("Tab Content Script: Page loaded.");

          // 2. Inject the prompt into the first textarea.
          const textarea = document.querySelector('textarea');
          if (!textarea) {
            throw new Error("No textarea found on the page.");
          }
          textarea.value = prompt;
          // Dispatch an 'input' event to ensure any JavaScript listeners on the textarea are triggered.
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true })); // Also common
          console.log("Tab Content Script: Prompt injected into textarea.");

          // 3. Click the first button with text "Run" or "Generate".
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const targetButton = buttons.find(btn => {
            const buttonText = (btn.textContent || btn.innerText || '').trim().toLowerCase();
            return buttonText === 'run' || buttonText === 'generate';
          });

          if (!targetButton) {
            throw new Error("No 'Run' or 'Generate' button found.");
          }
          targetButton.click();
          console.log("Tab Content Script: Clicked button:", targetButton.textContent);

          // 4. Wait a fixed 15 seconds.
          console.log("Tab Content Script: Waiting 15 seconds for generation...");
          await new Promise(resolve => setTimeout(resolve, 15000));
          console.log("Tab Content Script: Wait finished.");

          // 5. Extract the full HTML of the page.
          const pageHtml = document.documentElement.outerHTML;
          console.log("Tab Content Script: HTML extracted.");

          // 6. Send this HTML back to the background script.
          chrome.runtime.sendMessage({
            type: "PAGE_HTML_RESULT",
            html: pageHtml,
            originalLovableDevTabId: originalLovableDevTabId
          });
          console.log("Tab Content Script: HTML result sent to background.");

        } catch (error) {
          console.error("Tab Content Script: Error during page processing:", error);
          // Send error information back to the background script.
          chrome.runtime.sendMessage({
            type: "PAGE_HTML_RESULT",
            error: error.message,
            originalLovableDevTabId: originalLovableDevTabId
          });
        }
      }

      processPageActions();
      // Indicate that a response will be sent asynchronously if sendResponse were used directly.
      // For messages processed within the listener that don't call sendResponse, returning true
      // is good practice if any async operations are started by the listener.
      return true;
    }
  });

} else {
  // If script was already injected and window.tabScriptProcessed is true.
  console.log("Tab Content Script: Already processed this context. Not re-attaching listeners.");
  // Return false to indicate that the script did not successfully set up (or re-setup) message listeners.
  // This can help background.js understand if injection was a no-op due to prior injection.
  // Note: chrome.scripting.executeScript callback doesn't directly get this return value easily for 'files' injection.
  // This 'false' return is more for programmatic injection of functions.
  // For file injections, the guard `window.tabScriptProcessed` is the primary mechanism.
}
