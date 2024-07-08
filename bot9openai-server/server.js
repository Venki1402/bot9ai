const express = require("express");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();
const OpenAI = require("openai");
const { Message } = require("./database");
const { getRooms, bookRoom } = require("./hotelFunctions");

const app = express();
const PORT = process.env.PORT || 9000;

app.use(express.json());
app.use(express.static("public"));
app.use(cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendConfirmationEmail(email, fullName, roomType, nights, checkIn, checkOut) {
  console.log(`Attempting to send email to ${email}`);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Booking Confirmation",
    text: `Dear ${fullName},

Thank you for booking with us. Your reservation details are as follows:

Room Type: ${roomType}
Number of nights: ${nights}
Check-in date: ${checkIn}
Check-out date: ${checkOut}

We look forward to welcoming you!

Best regards,
Hotel Management`,
  };

  try {
    console.log('Mail options:', mailOptions);
    const info = await transporter.sendMail(mailOptions);
    console.log("Confirmation email sent:", info.response);
    return true;
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return false;
  }
}

app.get("/test", (req, res) => {
  res.send("Server is working");
});

app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Save user message to database
    await Message.create({ content: message, sender: "user", sessionId });

    // Retrieve conversation history
    const history = await Message.findAll({
      where: { sessionId },
      order: [["createdAt", "ASC"]],
      limit: 10,
    });

    // Format history for OpenAI API
    const messages = history.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Add system message with more explicit instructions
    messages.unshift({
      role: "system",
      content: "You are a hotel booking assistant. Use the get_rooms function to provide room information. Once you have collected all necessary information (roomType, fullName, email, nights, checkIn, checkOut), use the book_room function to finalize the booking. Do not repeat questions for information you already have."
    });

    // Add the new user message
    messages.push({ role: "user", content: message });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      functions: [
        {
          name: "get_rooms",
          description: "Get available hotel rooms",
          parameters: { type: "object", properties: {} },
        },
        {
          name: "book_room",
          description: "Book a hotel room",
          parameters: {
            type: "object",
            properties: {
              roomType: { type: "string" },
              fullName: { type: "string" },
              email: { type: "string" },
              nights: { type: "integer" },
              checkIn: { type: "string" },
              checkOut: { type: "string" },
            },
            required: ["roomType", "fullName", "email", "nights", "checkIn", "checkOut"],
          },
        },
      ],
      function_call: "auto",
    });

    console.log('OpenAI API Response:', JSON.stringify(response.choices[0].message, null, 2));

    let botReply = response.choices[0].message.content;
    let bookingResult = null;

    if (response.choices[0].message.function_call) {
      console.log('Function call detected:', response.choices[0].message.function_call);
      const functionName = response.choices[0].message.function_call.name;
      const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);
      console.log('Function name:', functionName);
      console.log('Function arguments:', functionArgs);

      let functionResult;
      if (functionName === "get_rooms") {
        console.log('Calling get_rooms function');
        functionResult = await getRooms();
      } else if (functionName === "book_room") {
        console.log('Calling book_room function');
        functionResult = await bookRoom(
          functionArgs.roomType,
          functionArgs.fullName,
          functionArgs.email,
          functionArgs.nights,
          functionArgs.checkIn,
          functionArgs.checkOut
        );
        console.log('Booking result:', functionResult);
        bookingResult = functionResult;

        if (functionResult.success) {
          console.log('Booking successful, sending confirmation email');
          await sendConfirmationEmail(
            functionArgs.email,
            functionArgs.fullName,
            functionArgs.roomType,
            functionArgs.nights,
            functionArgs.checkIn,
            functionArgs.checkOut
          );
        }
      }
      
      console.log('Function result:', functionResult);

      const secondResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          ...messages,
          response.choices[0].message,
          {
            role: "function",
            name: functionName,
            content: JSON.stringify(functionResult),
          },
        ],
      });

      botReply = secondResponse.choices[0].message.content;
    }

    // If a booking was made, append the result to the bot's reply
    if (bookingResult && bookingResult.success) {
      botReply += `\n\nYour booking has been confirmed. Here are the details:\n
      Room Type: ${bookingResult.roomType}
      Full Name: ${bookingResult.fullName}
      Email: ${bookingResult.email}
      Number of nights: ${bookingResult.nights}
      Check-in date: ${bookingResult.checkIn}
      Check-out date: ${bookingResult.checkOut}
      
      A confirmation email has been sent to your email address with all the details of your reservation.`;
    }

    // Save bot message to database
    await Message.create({ content: botReply, sender: "bot", sessionId });

    res.json({ reply: botReply });
  } catch (error) {
    console.error('Detailed error in /chat route:', error);
    res.status(500).json({ 
      error: "An error occurred", 
      details: error.message, 
      stack: error.stack 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});