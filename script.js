const messageForm = document.querySelector('.prompt_form');
const chatHistoryContainer = document.querySelector(".chats");
const suggestionItems = document.querySelectorAll('.suggests_item');
const themeToggleButton = document.getElementById("themeButton");
const clearChatButton = document.getElementById("deleteButton");
const navbar = document.querySelector(".navbar");

let currentUserMessage = null;
let isGeneratingResponse = false;

// navbar fixed position

window.addEventListener("scroll", () => {
    if(window.scrollY > 0){
        navbar.classList.add("navbar_fixed");
        chatHistoryContainer.classList.add("chats_scroll");
    }else{
        navbar.classList.remove("navbar_fixed");
        chatHistoryContainer.classList.remove("chats_scroll");
     }
});

// Google API Key to be used
const GOOGLE_API_KEY = "AIzaSyCPxRo19D_RMK3-c_Gk7OEr3MSqFMvqOxk";
const API_REQUEST_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`;

// load saved data from local storage
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem("saved_chats")) || [];
    const isLightTheme = localStorage.getItem("theme") === "light_mode";

    document.body.classList.toggle("light_mode", isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon"></i>' : '<i class="bx bx-sun"></i>';

    // empty chats
    chatHistoryContainer.innerHTML = "";

    // iterate all saved chat history and display them
    savedConversations.forEach(conversation => {
        // display the user's message
        const userMessageHtmlFormat = `
            <div class="message_content">
                <p class="message_text">${conversation.userMessage}</p>
                <img class="message_avatar" src="assets/profile.jpg" alt="User Avatar">
            </div>
        `;

        const outgoingMessageElement = createChatMessageElement(userMessageHtmlFormat, "message_outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement); // add to chats

        // display the API response
        const responseText = conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsedApiResponse = marked.parse(responseText); // convert to html format
        const rawApiResponse = responseText; // plain text version

        const responseHtmlFormat = `
            <div class="message_content">
                <img class="message_avatar" src="assets/gemini.svg" alt="Gemini Avatar">
                <p class="message_text"></p>
                <div class="message_loading_indicator hide">
                    <div class="message_loading_indicator_bar"></div>
                    <div class="message_loading_indicator_bar"></div>
                    <div class="message_loading_indicator_bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message_icon hide">
                <i class='bx bx-copy-alt'></i>
            </span>
        `;

        const incomingMessageElement = createChatMessageElement(responseHtmlFormat, "message_incoming");
        chatHistoryContainer.appendChild(incomingMessageElement); // add to chats

        // get message text element
        const messageTextElement = incomingMessageElement.querySelector(".message_text");

        // display saved chat without typing effect
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true); // true means skip typing effect
    });

    // hide header if there is any chat history
    document.body.classList.toggle("hide_header", savedConversations.length > 0);
}

// create a new chat message element
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", ...cssClasses);
    messageElement.innerHTML = htmlContent;

    return messageElement;
}

// show typing effect
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector(".message_icon");
    copyIconElement.classList.add("hide"); // initially hide copy button

    if(skipEffect){
        // display content directly without typing effect
        messageElement.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIconElement.classList.remove("hide");
        isGeneratingResponse = false;
        return;
    }

    const wordsArray = rawText.split(" ");
    let wordIndex = 0;

    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? "" : " ") + wordsArray[wordIndex++]; // show raw text first

        if(wordIndex === wordsArray.length){
            clearInterval(typingInterval);
            isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide");
        }
    }, 75);
}

// fetch API response based on user input
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector(".message_text");
    try{
        const response = await fetch(API_REQUEST_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: currentUserMessage }] }]
            })
        });

        const responseData = await response.json();
        if(!response.ok){
            throw new Error(responseData.error.message);
        }

        const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if(!responseText){
            throw new Error("No response from API");
        }
        const parsedApiResponse = marked.parse(responseText);
        const rawApiResponse = responseText;
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // save conversation to local storage
        let savedConversations = JSON.parse(localStorage.getItem("saved_chats")) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseData
        });
        localStorage.setItem("saved_chats", JSON.stringify(savedConversations));
    }catch(error){
        isGeneratingResponse = false;
        messageTextElement.innerText = error.message;
        messageTextElement.closest(".message").classList.add("message_error");
    }finally{
        incomingMessageElement.classList.remove("message_loading");
    }
}

// add copy button to code blocks including language label
const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll("pre");
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector("code");
        let language = [...codeElement.classList].find(cls => cls.startsWith("language-"))?.replace("language-", "") || "Text";

        const languageLabel = document.createElement("div");
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1);
        languageLabel.classList.add("code_language_label");
        block.appendChild(languageLabel);

        // copy button
        const copyButton = document.createElement("button");
        copyButton.innerHTML = '<i class="bx bx-copy"></i>';
        copyButton.classList.add("code_copy_button");
        block.appendChild(copyButton);

        copyButton.addEventListener("click",()=>{
            navigator.clipboard.writeText(codeElement.innerText).then (() => {
                copyButton.innerHTML = '<i class="bx bx-check"></i>';
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="bx bx-copy"></i>';
                }, 2000);
            }).catch(error => {
                console.log("Unable to copy: ", error);
                alert("Unable to copy text!");
            });
        });
    });
}

// show loading animation during API request
const displayLoadingAnimation = () => {
    const loadingHtmlFormat = `
    <div class="message_content">
                <img class="message_avatar" src="assets/gemini.svg" alt="Gemini Avatar">
                <p class="message_text"></p>
                <div class="message_loading_indicator">
                    <div class="message_loading_indicator_bar"></div>
                    <div class="message_loading_indicator_bar"></div>
                    <div class="message_loading_indicator_bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message_icon hide">
                <i class='bx bx-copy-alt'></i>
            </span>
    `;

    const loadingMessageElement = createChatMessageElement(loadingHtmlFormat, "message_incoming", "message_loading");
    chatHistoryContainer.appendChild(loadingMessageElement);

    requestApiResponse(loadingMessageElement);
}

// copy message to clipboard
const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message_text").innerText;
    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = '<i class="bx bx-check"></i>';
    setTimeout(() => {
        copyButton.innerHTML = '<i class="bx bx-copy-alt"></i>';
    }, 1000);
}

// handle sending chat messages from user
const handleOutgoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt_form_input").value.trim() || currentUserMessage;

    if(!currentUserMessage || isGeneratingResponse){
        return;
    }

    isGeneratingResponse = true;

    const outgoingMessageHtmlFormat = `
        <div class="message_content">
                <p class="message_text"></p>
                <img class="message_avatar" src="assets/profile.jpg" alt="User Avatar">
        </div>
    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtmlFormat, "message_outgoing");

    outgoingMessageElement.querySelector(".message_text").innerText = currentUserMessage;
    chatHistoryContainer.appendChild(outgoingMessageElement);

    messageForm.reset(); // clear input field
    document.body.classList.add("hide_header");
    setTimeout(displayLoadingAnimation,500);
}

// toggle between light and dark themes
themeToggleButton.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("theme", isLightTheme ? "light_mode" : "dark_mode");

    // update icon based on theme
    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});

// clear all chat history
clearChatButton.addEventListener("click", () => {
    if(confirm("Are you sure you want to clear all chat history?")){
        localStorage.removeItem("saved_chats");

        // reload chat history to reflect changes
        loadSavedChatHistory();

        currentUserMessage = null;
        isGeneratingResponse = false;
    }
});

// handle click on suggestion items
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener("click", () => {
        currentUserMessage = suggestion.querySelector(".suggests_item_text").innerText;
        handleOutgoingMessage();
    });
});

// prevent default from submission and handle outgoing message
messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOutgoingMessage();
});

// load saved chat history on page load
loadSavedChatHistory();
