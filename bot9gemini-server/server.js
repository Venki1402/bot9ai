const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const { Conversation } = require("./database");
const { getRoomOptions, bookRoom } = require("./hotelFunctions");

dotenv.config();

class GeminiService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async createChatCompletion(messages) {
    const chat = this.model.startChat();
    let response;

    for (const message of messages) {
      response = await chat.sendMessage(message.content);
    }

    return response.response.text();
  }
}

const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.json({ message: "Welcome to the Bot9 Gemini Server!" });
});

app.post("/chat", async (req, res) => {
  const { message, userId } = req.body;

  try {
    const conversation = await Conversation.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    const chatHistory = conversation.reverse().flatMap((c) => [
      { role: "user", content: c.message },
      { role: "model", content: c.response },
    ]);

    const systemPrompt = `You are a helpful hotel booking assistant for Bot9 Palace. Always start by fetching and displaying room options when a user expresses interest in booking. Then guide the user through the booking process, asking for necessary details one by one.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: message },
    ];

    let responseContent = await geminiService.createChatCompletion(messages);

    // If the message includes any mention of booking or rooms, fetch and display room options
    if (
      message.toLowerCase().includes("book") ||
      message.toLowerCase().includes("room")
    ) {
      const roomOptions = await getRoomOptions();
      responseContent = `Certainly! I'd be happy to help you book a room at Bot9 Palace. Here are our available room options: ${JSON.stringify(
        roomOptions,
        null,
        2
      )}
        Which room would you like to book? Please provide the room ID, your full name, email address, and the number of nights you'd like to stay.`;
    }

    // Check if the user message contains booking details
    const bookingDetailsMatch = message.match(
      /book room id (\d+), my name is ([^,]+), my email is ([^,]+), (\d+) nights/
    );
    if (bookingDetailsMatch) {
      const [, roomId, fullName, email, nights] = bookingDetailsMatch;
      const bookingResult = await bookRoom(
        parseInt(roomId),
        fullName,
        email,
        parseInt(nights)
      );
      responseContent = `Booking confirmed:\n${JSON.stringify(bookingResult, null, 2)}`;
    }

    await Conversation.create({
      userId,
      message,
      response: responseContent,
    });

    res.json({ response: responseContent });
  } catch (error) {
    console.error("Error processing chat:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

// Endpoint to reset the database
app.post("/reset-database", async (req, res) => {
  try {
    await resetDatabase();
    res.json({ message: "Database has been reset." });
  } catch (error) {
    console.error("Error resetting database:", error);
    res
      .status(500)
      .json({ error: "An error occurred while resetting the database." });
  }
});

async function resetDatabase() {
  try {
    await sequelize.drop(); // This drops all tables
    await sequelize.sync(); // This recreates the tables
    console.log("Database has been reset.");
  } catch (error) {
    console.error("Error resetting database:", error);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
