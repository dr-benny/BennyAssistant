import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  AttachmentBuilder,
  Message,
  User,
  DMChannel,
  ButtonInteraction,
  Partials,
  Interaction,
} from "discord.js";
import * as dotenv from "dotenv";
import axios from "axios";
import { Course } from "../models/Course";
import * as QRCode from "qrcode";
import jsQR from "jsqr";
import { createCanvas, loadImage } from "canvas";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// Global collector maps
const activeCollectors = new Map<string, any>();
const activeCollectorsDm = new Map<string, any>();

// ============= COMMAND REGISTRATION =============
const commands = [
  new SlashCommandBuilder().setName("menu").setDescription("แสดงเมนูทั้งหมด"),
].map((command) => command.toJSON());

(async () => {
  try {
    console.log("กำลังลงทะเบียน Slash Commands...");
    await rest.put(Routes.applicationGuildCommands(clientId!, guildId!), {
      body: commands,
    });
    console.log("ลงทะเบียน Slash Commands สำเร็จ!");
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการลงทะเบียน:", error);
  }
})();

client.once("ready", () => {
  console.log(`logged in as ${client.user?.tag}`);
});

// ============= HELPER FUNCTIONS =============

/**
 * สร้าง QR Code และส่งกลับ embed พร้อม attachment
 */
async function createQRPaymentEmbed(
  transactionId: string,
  price: number,
  discountMessage?: string
) {
  const response_QR = await axios.post(
    `${API_BASE_URL}/transaction/createQrCode`,
    { transactionId }
  );

  const qrBuffer = await QRCode.toBuffer(response_QR.data.qrCodeData);
  const qrAttachment = new AttachmentBuilder(qrBuffer, { name: "qrcode.png" });
  const formattedPrice = Number(price).toLocaleString("th-TH");

  const description = [
    discountMessage || "",
    "กรุณาชำระเงินโดยสแกน QR Code ด้านล่างผ่านแอปธนาคารของคุณ",
    "",
    "🕒 *หลังจากชำระเงินแล้ว โปรดกดปุ่มอัปโหลดสลิปการชำระเงินจะมีเวลาแค่ ",
    "**10 นาที** ในการ upload โปรดชำระเงินก่อนและค่อยกด!!!*",
    "",
    `**ราคาที่ต้องชำระ:** ฿${formattedPrice}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const embed = {
    color: 0x00bfff,
    title: "!! ธุรกรรมรอดำเนินการ  !!",
    description,
    image: { url: "attachment://qrcode.png" },
    footer: { text: "ระบบชำระเงินอัตโนมัติ BennyBot" },
    timestamp: new Date().toISOString(),
  };

  return { embed, qrAttachment };
}

/**
 * จัดการการอัปโหลดสลิปและตรวจสอบการชำระเงิน
 */
async function handleUploadSlip(
  buttonInteraction: ButtonInteraction,
  transactionData: any
) {
  await buttonInteraction.deferReply({ ephemeral: true });
  const user: User = buttonInteraction.user;

  // สร้าง DM Channel
  let dmChannel: DMChannel;
  try {
    dmChannel = await user.createDM();
  } catch (err) {
    await buttonInteraction.followUp({
      content: "❌ ไม่สามารถส่ง DM ให้คุณได้ กรุณาเปิด DM กับ bot ก่อน",
      ephemeral: true,
    });
    return;
  }

  await buttonInteraction.followUp({
    content: "กรุณาเช็ก DM และดำเนินการอัปโหลดสลิปผ่าน DM ส่วนตัวกับ Bot",
    ephemeral: true,
  });

  // ตั้งค่า countdown
  const duration = 600;
  let remaining = duration;

  const sentMessage = await dmChannel.send(
    `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
  );

  let interval: NodeJS.Timeout | null = setInterval(async () => {
    remaining--;
    try {
      await sentMessage.edit(
        `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
      );
    } catch {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    if (remaining <= 0) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      try {
        await sentMessage.edit(
          "❌ หมดเวลาการอัปโหลดสลิป กรุณาดำเนินการใหม่อีกครั้ง โดย /menu ใหม่ที่เซิร์ฟเวอร์หลัก"
        );
      } catch {}
    }
  }, 1000);

  // Stop collector เก่า
  const oldCollector = activeCollectorsDm.get(user.id);
  if (oldCollector && !oldCollector.ended) {
    oldCollector.stop("new_interaction_DM");
  }

  // สร้าง DM collector ใหม่
  const dmCollector = dmChannel.createMessageCollector({
    filter: (m) => m.author.id === user.id && m.attachments.size > 0,
    time: 600_000,
    max: 1,
  });

  activeCollectorsDm.set(user.id, dmCollector);

  // Cleanup เมื่อ collector หมดเวลาหรือ stop
  dmCollector.on("end", (collected, reason) => {
    console.log(`DM Collector ended for ${user.username}: ${reason}`);
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    activeCollectorsDm.delete(user.id);
    activeCollectors.delete(user.id);
  });

  // จัดการเมื่อได้รับสลิป
  dmCollector.on("collect", async (m: Message) => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }

    const slip = m.attachments.first();
    if (!slip) {
      dmCollector.stop("no_attachment");
      return;
    }

    await dmChannel.send(`⏳ กำลังตรวจสอบสลิป...`);

    try {
      // อ่าน QR Code จากสลิป
      const image = await loadImage(slip.url);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (!qrCode) {
        await dmChannel.send(
          `❌ ไม่พบ QR Code ในรูปภาพ กรุณาส่งสลิปที่ชัดเจนอีกครั้ง`
        );
        dmCollector.stop("no_qr_code");
        return;
      }

      const qrData = qrCode.data;

      // ตรวจสอบสลิปกับ SlipOK API
      try {
        const verifyResponse = await axios.post(
          `https://api.slipok.com/api/line/apikey/${process.env.BRANCH_ID}`,
          {
            data: qrData,
            log: true,
            amount: Number(transactionData.price),
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-authorization": process.env.SLIPOK_API_KEY,
            },
          }
        );

        if (verifyResponse.data.success) {
          await dmChannel.send(
            `✅ ชำระเงินสำเร็จคุณจะได้รับยศใน discord และ มองเห็นห้องเรียน!`
          );

          // อัปเดตสถานะการชำระเงิน
          await axios.put(`${API_BASE_URL}/transaction/updatePaymentStatus`, {
            id: transactionData.id,
            paid: true,
          });

          // เพิ่มยศให้ผู้ใช้
          try {
            const guild = buttonInteraction.guild;
            if (!guild) throw new Error("Guild not found");

            const member = await guild.members.fetch(m.author.id);
            const role = guild.roles.cache.find(
              (r) => r.name === transactionData.courseCode
            );

            if (role) {
              await member.roles.add(role);
              await dmChannel.send(
                `🎉 เพิ่มยศ "${role.name}" สำเร็จแล้ว! กรุณาตรวจสอบในเซิร์ฟเวอร์หลัก`
              );
            } else {
              await dmChannel.send(
                `⚠️ ไม่พบยศ "${transactionData.courseCode}" ในเซิร์ฟเวอร์ กรุณาติดต่อแอดมิน`
              );
            }
          } catch (roleError) {
            await dmChannel.send(
              `⚠️ เกิดข้อผิดพลาดในการเพิ่มยศ กรุณาติดต่อแอดมิน`
            );
            console.error("Role Error:", roleError);
          }
        } else {
          await dmChannel.send(
            `❌ การตรวจสอบล้มเหลว: ${verifyResponse.data.message} /menu ที่เซิร์ฟเวอร์หลักอีกครั้ง`
          );
        }
      } catch (apiError: any) {
        await dmChannel.send(
          `❌ ${
            apiError.response?.data?.message ||
            "เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่ /menu ที่เซิร์ฟเวอร์หลักอีกครั้ง"
          }`
        );
        console.error("API Error:", apiError);
      }
    } catch (error) {
      await dmChannel.send(`❌ เกิดข้อผิดพลาดในการอ่านสลิป`);
      console.error("QR Scan Error:", error);
    } finally {
      dmCollector.stop("done");
    }
  });
}

/**
 * แสดง QR Code และรอให้ผู้ใช้อัปโหลดสลิป
 */
async function showQRCodeAndWaitForSlip(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  transactionData: any,
  discountMessage?: string
) {
  const { embed, qrAttachment } = await createQRPaymentEmbed(
    transactionData.id,
    transactionData.price,
    discountMessage
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("upload_slip")
      .setLabel("อัปโหลดสลิปการชำระเงิน")
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({
    embeds: [embed],
    files: [qrAttachment],
    components: [row],
    ephemeral: true,
  });

  // สร้าง collector สำหรับปุ่ม upload_slip
  const filter = (i: any) =>
    i.isButton() &&
    i.customId === "upload_slip" &&
    i.user.id === interaction.user.id;

  // Stop collector เก่า
  if (activeCollectors.has(interaction.user.id)) {
    activeCollectors.get(interaction.user.id).stop("new_interaction");
  }

  const collector = interaction.channel?.createMessageComponentCollector({
    filter,
    max: 1,
    time: 600_000,
  });

  activeCollectors.set(interaction.user.id, collector);

  collector?.on("collect", async (buttonInteraction) => {
    activeCollectors.delete(interaction.user.id);
    if (!buttonInteraction.isButton()) return;
    await handleUploadSlip(buttonInteraction, transactionData);
  });

  collector?.on("end", (collected, reason) => {
    console.log(`Upload collector ended: ${reason}`);
    activeCollectors.delete(interaction.user.id);
  });
}

// ============= INTERACTION HANDLERS =============

async function handleMenuCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "menu") return;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("menu_courses")
      .setLabel("All Courses")
      .setEmoji("📚")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("About Tutor")
      .setEmoji("👨‍🏫")
      .setStyle(ButtonStyle.Link)
      .setURL(
        "https://drive.google.com/file/d/1meUhGyUyq3tNMIcq5udr3ZUt36mKGsNu/view?usp=sharing"
      ),
    new ButtonBuilder()
      .setCustomId("menu_support")
      .setLabel("Support")
      .setEmoji("💬")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("Main Menu")
        .setDescription(
          "**กรุณาเลือกเมนูที่ต้องการ**\n\n" +
            "> 📚 **All Course**\n" +
            "> ดูคอร์สเรียนทั้งหมดที่มีให้บริการ\n\n" +
            "> 👨‍🏫 **About Tutor**\n" +
            "> ข้อมูลเกี่ยวกับติวเตอร์และประสบการณ์\n\n" +
            "> 💬 **Support**\n" +
            "> ติดต่อสอบถามหรือขอความช่วยเหลือ"
        )
        .setFooter({
          text: "BennyAssistant • กดปุ่มด้านล่างเพื่อเลือก",
        })
        .setTimestamp(),
    ],
    components: [row],
    ephemeral: true,
  });
}

async function handleMenuCoursesButton(interaction: ButtonInteraction) {
  try {
    const response = await axios.get<Course[]>(`${API_BASE_URL}/course`);
    const courses = response.data;

    if (courses.length === 0) {
      await interaction.reply({
        content: "ไม่พบคอร์สในขณะนี้",
        ephemeral: true,
      });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>();
    courses.forEach((course, index) => {
      if (index < 5) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`course_${course.code}`)
            .setLabel(course.title)
            .setStyle(ButtonStyle.Success)
        );
      }
    });

    const courseEmbed = new EmbedBuilder()
      .setColor("#00D9FF")
      .setTitle("📚 All Courses")
      .setDescription("รายการคอร์สทั้งหมดที่เปิดสอน")
      .setTimestamp();

    courses.forEach((course) => {
      courseEmbed.addFields({
        name: `**${course.title}**`,
        value: [
          `> **รหัสวิชา:** \`${course.code}\``,
          `> **ราคา:** ฿${Number(course.price).toLocaleString("th-TH")}`,
        ].join("\n"),
        inline: false,
      });
    });

    courseEmbed.setFooter({
      text: `\nโปรดเลือก Course ที่สนใจจากปุ่มด้านล่าง`,
    });

    await interaction.reply({
      embeds: [courseEmbed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    await interaction.reply({
      content: "❌ เกิดข้อผิดพลาดในการดึงข้อมูลคอร์ส กรุณาลองใหม่อีกครั้ง",
      ephemeral: true,
    });
  }
}

async function handleMenuSupportButton(interaction: ButtonInteraction) {
  await interaction.reply({
    content:
      "💬 **Support**\nติดต่อสอบถามหรือขอความช่วยเหลือได้ที่ Discord นี้ : <@495284915202424843>",
    ephemeral: true,
  });
}

async function handleCourseSelection(interaction: ButtonInteraction) {
  const courseCode = interaction.customId.replace("course_", "");

  try {
    // ตรวจสอบว่าผู้ใช้มีคอร์สนี้อยู่แล้วหรือไม่
    await axios.get(`${API_BASE_URL}/transaction/check`, {
      params: {
        username: interaction.user.username,
        courseCode,
      },
    });

    // ถ้าไม่มี error แสดงว่ายังไม่มีคอร์ส สร้าง transaction ใหม่
    const courseResponse = await axios.get(
      `${API_BASE_URL}/course/${courseCode}`
    );

    await axios.post(`${API_BASE_URL}/transaction`, {
      username: interaction.user.username,
      courseCode,
      price: Number(courseResponse.data.price),
    });

    // ถามว่ามีส่วนลดหรือไม่
    await showDiscountPrompt(interaction, courseCode);
  } catch (error: any) {
    if (error.response?.status === 408) {
      // Transaction รอดำเนินการ - ถามว่ามีส่วนลดหรือไม่
      await showDiscountPrompt(interaction, courseCode);
    } else if (error.response?.status === 409) {
      // มีคอร์สอยู่แล้ว
      await interaction.reply({
        content:
          "❌ คุณมีคอร์สนี้อยู่ในระบบแล้ว หากไม่สามารถเข้าถึงคอร์สได้ กรุณาติดต่อแอดมิน",
        ephemeral: true,
      });
    } else if (error.response?.status === 407) {
      // Transaction รอดำเนินการแล้ว แสดง QR ทันที
      const transactionData = error.response.data.transaction;
      await showQRCodeAndWaitForSlip(interaction, transactionData);
    } else {
      await interaction.reply({
        content: "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
        ephemeral: true,
      });
    }
  }
}

async function showDiscountPrompt(
  interaction: ButtonInteraction,
  courseCode: string
) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`Discounted_Code_yes_${courseCode}`)
      .setLabel("มี")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`Discounted_Code_No+${courseCode}`)
      .setLabel("ไม่มี")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("คุณมีรหัสส่วนลดหรือไม่?")
        .setFooter({
          text: "BennyAssistant • กดปุ่มด้านล่างเพื่อเลือก",
        })
        .setTimestamp(),
    ],
    components: [row],
    ephemeral: true,
  });
}

async function handleDiscountYesButton(interaction: ButtonInteraction) {
  const courseCode = interaction.customId.split("_")[3];

  const modal = new ModalBuilder()
    .setCustomId(`discountModal_${courseCode}`)
    .setTitle("กรอกรหัสส่วนลด");

  const discountInput = new TextInputBuilder()
    .setCustomId("discountCode")
    .setLabel("รหัสส่วนลดของคุณ")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("เช่น SAVE20");

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    discountInput
  );
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

async function handleDiscountNoButton(interaction: ButtonInteraction) {
  const courseCode = interaction.customId.split("_")[3];

  try {
    const transaction = await axios.get(
      `${API_BASE_URL}/transaction/getTransactionByUsernameAndCourse`,
      {
        params: {
          username: interaction.user.username,
          courseCode,
        },
      }
    );

    await showQRCodeAndWaitForSlip(interaction, transaction.data);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    await interaction.reply({
      content: "❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      ephemeral: true,
    });
  }
}

async function handleDiscountModal(modalInteraction: ModalSubmitInteraction) {
  const discountCode =
    modalInteraction.fields.getTextInputValue("discountCode");
  const courseCode = modalInteraction.customId.split("_")[1];

  try {
    // ตรวจสอบรหัสส่วนลด
    const response = await axios.get(
      `${API_BASE_URL}/discount/${discountCode}`
    );
    const discount = response.data;

    if (discount.used) {
      await modalInteraction.reply({
        content: "❌ รหัสส่วนลดนี้ถูกใช้ไปแล้ว กรุณาลองใหม่อีกครั้ง",
        ephemeral: true,
      });
      return;
    }

    // ทำเครื่องหมายว่าใช้แล้ว
    discount.used = true;
    await axios.put(`${API_BASE_URL}/discount/`, discount);

    // อัปเดตราคาใน transaction
    await axios.put(`${API_BASE_URL}/transaction/updateDiscountPrice`, {
      code: discount.code,
      price: discount.discount_price,
      username: modalInteraction.user.username,
      courseCode,
    });

    // ดึงข้อมูล transaction ที่อัปเดตแล้ว
    const transaction = await axios.get(
      `${API_BASE_URL}/transaction/getTransactionByUsernameAndCourse`,
      {
        params: {
          username: modalInteraction.user.username,
          courseCode,
        },
      }
    );

    const discountMessage = `คุณได้รับส่วนลด ${discount.discount_price} บาท`;
    await showQRCodeAndWaitForSlip(
      modalInteraction,
      transaction.data,
      discountMessage
    );
  } catch (error: any) {
    await modalInteraction.reply({
      content: "❌ รหัสส่วนลดไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
      ephemeral: true,
    });
    console.error("Discount Code Error:", error.message);
  }
}

// ============= MAIN INTERACTION HANDLER =============
client.on("interactionCreate", async (interaction) => {
  try {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
      await handleMenuCommand(interaction);
      return;
    }

    // Button Interactions
    if (interaction.isButton()) {
      if (interaction.customId === "menu_courses") {
        await handleMenuCoursesButton(interaction);
      } else if (interaction.customId === "menu_support") {
        await handleMenuSupportButton(interaction);
      } else if (interaction.customId.startsWith("course_")) {
        await handleCourseSelection(interaction);
      } else if (interaction.customId.startsWith("Discounted_Code_yes")) {
        await handleDiscountYesButton(interaction);
      } else if (interaction.customId.startsWith("Discounted_Code_No")) {
        await handleDiscountNoButton(interaction);
      }
      return;
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("discountModal_")) {
        await handleDiscountModal(interaction);
      }
      return;
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
  }
});

client.login(process.env.DISCORD_TOKEN);
