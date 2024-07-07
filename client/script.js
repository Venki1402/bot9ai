import bot from "./assets/bot.svg";
import user from "./assets/user.svg";

const form = document.querySelector("form");
const chatContainer = document.querySelector("#chat_container");

let loadInterval;

// loader...
function loader(element) {
  element.textContent = "";
  loadInterval = setInterval(() => {
    element.textContent += ".";
    if (element.textContent === "....") {
      element.textContent = "";
    }
  }, 300);
}

// Typing effect
function typeText(element, text) {
  if (!text) {
    console.error("Text is undefined or null in typeText function");
    element.innerHTML = "No response received.";
    return;
  }
  let index = 0;
  let interval = setInterval(() => {
    if (index < text.length) {
      element.innerHTML += text.charAt(index);
      index++;
    } else {
      clearInterval(interval);
    }
  }, 20);
}

// Generate unique id
function generateUniqueId() {
  const timestamp = Date.now();
  const randomNumber = Math.random();
  const hexadecimalString = randomNumber.toString(16);
  return `id-${timestamp}-${hexadecimalString}`;
}

// Chat stripe
function chatStripe(isAi, value, uniqueId) {
  return `
      <div class="wrapper ${isAi && "ai"}">
        <div class="chat">
          <div class="profile">
            <img src="${isAi ? bot : user}"
                 alt="avatar of ${isAi ? "bot" : "user"}" 
            />
          </div> 
          <div class="message" id="${uniqueId}"> 
            ${value}
          </div>
        </div>
      </div>


    `;
}

// // Chat response // gemini AI
// const handleSubmit = async (e) => {
//   e.preventDefault();
//   const data = new FormData(form);

//   // user chat
//   chatContainer.innerHTML += chatStripe(false, data.get("prompt"));

//   form.reset();

//   // ai chat
//   const uniqueId = generateUniqueId();
//   chatContainer.innerHTML += chatStripe(true, " ", uniqueId);

//   chatContainer.scrollTop = chatContainer.scrollHeight;

//   const messageDiv = document.getElementById(uniqueId);
//   loader(messageDiv);

//   // fetch data from server
//   const response = await fetch("http://localhost:3000/chat", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       message: data.get("prompt"),
//       userId: "user123" // You might want to implement actual user management
//     }),
//   });

//   clearInterval(loadInterval);
//   messageDiv.innerHTML = "";

//   if (response.ok) {
//     const { response: botResponse } = await response.json();
//     typeText(messageDiv, botResponse);
//   } else {
//     const err = await response.text();
//     messageDiv.innerHTML = "Something went wrong!";
//     alert(err);
//   }
// };

// CHAT RESPONSE // openai
const handleSubmit = async (e) => {
  e.preventDefault();
  const data = new FormData(form);

  // user chat
  chatContainer.innerHTML += chatStripe(false, data.get("prompt"));

  form.reset();

  // ai chat
  const uniqueId = generateUniqueId();
  chatContainer.innerHTML += chatStripe(true, " ", uniqueId);

  chatContainer.scrollTop = chatContainer.scrollHeight;

  const messageDiv = document.getElementById(uniqueId);
  loader(messageDiv);

  // fetch data from server
  const response = await fetch("https://bot9ai.onrender.com/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: data.get("prompt"),
      sessionId: "54321",
    }),
  });

  clearInterval(loadInterval);
  messageDiv.innerHTML = "";

  if (response.ok) {
    const data = await response.json();
    console.log("Response data:", data);
    if (data && data.reply) {
      typeText(messageDiv, data.reply);
    } else {
      console.error("Unexpected response structure:", data);
      messageDiv.innerHTML = "Received an unexpected response format.";
    }
  } else {
    const err = await response.text();
    console.error("Error response:", err);
    messageDiv.innerHTML = "Something went wrong!";
    alert(err);
  }
};

form.addEventListener("submit", handleSubmit);
form.addEventListener("keyup", (e) => {
  if (e.key == "Enter") {
    handleSubmit(e);
  }
});
