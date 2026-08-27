import "dotenv/config";
import express from "express";
import aiRoutes from "./routes/ai.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/ai", aiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
