import * as express from "express";
import * as dotenv from "dotenv";
import courseRoutes from "../routes/courseRoutes";
import discountRoutes from "../routes/discountRoutes";
import transactionRoutes from "../routes/transactionRoutes";
dotenv.config();
const app = express();
app.use(express.json());

app.use("/course", courseRoutes);
app.use("/discount", discountRoutes);
app.use("/transaction", transactionRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
