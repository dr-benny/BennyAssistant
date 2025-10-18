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
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  MentionableSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  Partials,
} from "discord.js";
import * as dotenv from "dotenv";
import axios from "axios";
import { Course } from "../models/Course";
import * as QRCode from "qrcode";
import jsQR from "jsqr";
import { createCanvas, loadImage } from "canvas";
import { error } from "console";
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

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "menu") {
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
  }

  if (interaction.isButton()) {
    if (interaction.customId === "menu_courses") {
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

        courses.forEach((course, index) => {
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
        await interaction.editReply({
          content: "❌ เกิดข้อผิดพลาดในการดึงข้อมูลคอร์ส กรุณาลองใหม่อีกครั้ง",
        });
      }
    } else if (interaction.customId === "menu_support") {
      await interaction.reply({
        content:
          "💬 **Support**\nติดต่อสอบถามหรือขอความช่วยเหลือได้ที่ Discord นี้ : <@495284915202424843>",
        ephemeral: true,
      });
    } else if (interaction.customId.startsWith("course_")) {
      try {
        const response = await axios.get(`${API_BASE_URL}/transaction/check`, {
          params: {
            username: interaction.user.username,
            courseCode: interaction.customId.replace("course_", ""),
          },
        });
        const createTransactionResponse = await axios.post(
          `${API_BASE_URL}/transaction`,
          {
            username: interaction.user.username,
            courseCode: interaction.customId.replace("course_", ""),
            price: Number(
              await axios
                .get(
                  `${API_BASE_URL}/course/${interaction.customId.replace(
                    "course_",
                    ""
                  )}`
                )
                .then((res) => res.data.price)
            ),
          }
        );
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(
              "Discounted_Code_yes_" +
                interaction.customId.replace("course_", "")
            )
            .setLabel("มี")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(
              "Discounted_Code_No+" +
                interaction.customId.replace("course_", "")
            )
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
      } catch (error: any) {
        if (error.response.status == 408) {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(
                `Discounted_Code_yes_${interaction.customId.replace(
                  "course_",
                  ""
                )}`
              )
              .setLabel("มี")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(
                "Discounted_Code_No+" +
                  interaction.customId.replace("course_", "")
              )
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
        } else if (error.response.status == 409) {
          await interaction.reply({
            content:
              "❌ คุณมีคอร์สนี้อยู่ในระบบแล้ว หากไม่สามารถเข้าถึงคอร์สได้ กรุณาติดต่อแอดมิน",
            ephemeral: true,
          });
        } else if (error.response.status == 407) {
          const response = await axios.post(
            `${API_BASE_URL}/transaction/createQrCode`,
            {
              transactionId: error.response.data.transaction.id,
            }
          );
          const qrBuffer = await QRCode.toBuffer(response.data.qrCodeData);
          const qrAttachment = new AttachmentBuilder(qrBuffer, {
            name: "qrcode.png",
          });
          const qrCodeUrl = await QRCode.toDataURL(response.data.qrCodeData);
          const price = Number(
            error.response.data.transaction.price
          ).toLocaleString("th-TH");

          const embed = {
            color: 0x00bfff,
            title: "!! ธุรกรรมรอดำเนินการ  !!",
            description: [
              "กรุณาชำระเงินโดยสแกน QR Code ด้านล่างผ่านแอปธนาคารของคุณ",
              "",
              "🕒 *หลังจากชำระเงินแล้ว โปรดกดปุ่มอัปโหลดสลิปการชำระเงินจะมีเวลาแค่ ",
              "**10 นาที** ในการ upload โปรดชำระเงินก่อนและค่อยกด!!!*",
              "",
              `**ราคาที่ต้องชำระ:** ฿${price}`,
            ].join("\n"),
            image: { url: "attachment://qrcode.png" },
            footer: { text: "ระบบชำระเงินอัตโนมัติ BennyBot" },
            timestamp: new Date().toISOString(),
          };
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

          const filter = (
            i:
              | ButtonInteraction
              | StringSelectMenuInteraction
              | UserSelectMenuInteraction
              | RoleSelectMenuInteraction
              | MentionableSelectMenuInteraction
              | ChannelSelectMenuInteraction
          ) => {
            return (
              i.isButton() &&
              i.customId === "upload_slip" &&
              i.user.id === interaction.user.id
            );
          };
          const activeCollectors = new Map<string, any>();
          if (activeCollectors.has(interaction.user.id)) {
            activeCollectors.get(interaction.user.id).stop("new_interaction");
          }

          const collector =
            interaction.channel?.createMessageComponentCollector({
              filter,
              max: 1,
              time: 600_000,
            });

          activeCollectors.set(interaction.user.id, collector);
          async function handleUploadSlip(interaction: ButtonInteraction) {
            const user: User = interaction.user;

            let dmChannel: DMChannel;
            try {
              dmChannel = await user.createDM();
            } catch (err) {
              await interaction.reply({
                content:
                  "❌ ไม่สามารถส่ง DM ให้คุณได้ กรุณาเปิด DM กับ bot ก่อน",
                ephemeral: true,
              });
              return;
            }

            await interaction.reply({
              content:
                "กรุณาเช็ก DM และดำเนินการอัปโหลดสลิปผ่าน DM ส่วนตัวกับ Bot",
              ephemeral: true,
            });

            const duration = 600;
            let remaining = duration;

            const sentMessage = await dmChannel.send(
              `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
            );

            const interval = setInterval(async () => {
              remaining--;
              try {
                await sentMessage.edit(
                  `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
                );
              } catch {
                clearInterval(interval);
              }
              if (remaining <= 0) {
                clearInterval(interval);
                try {
                  await sentMessage.edit(
                    "❌ หมดเวลาการอัปโหลดสลิป กรุณาดำเนินการใหม่อีกครั้ง โดย /menu ใหม่ที่เซิร์ฟเวอร์หลัก"
                  );
                } catch {}
                dmCollector.stop("time");
              }
            }, 1000);
            const dmCollector = dmChannel.createMessageCollector({
              filter: (m) => m.author.id === user.id && m.attachments.size > 0,
              time: 600_000,
              max: 1,
            });

            dmCollector.on("collect", async (m: Message) => {
              clearInterval(interval);
              dmCollector.stop("time");
              const slip = m.attachments.first();

              if (!slip) return;
              await dmChannel.send(`⏳ กำลังตรวจสอบสลิป...`);

              try {
                const image = await loadImage(slip.url);
                const canvas = createCanvas(image.width, image.height);
                const ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0);

                const imageData = ctx.getImageData(
                  0,
                  0,
                  image.width,
                  image.height
                );

                const qrCode = jsQR(
                  imageData.data,
                  imageData.width,
                  imageData.height
                );

                if (qrCode) {
                  const qrData = qrCode.data;

                  try {
                    const verifyResponse = await axios.post(
                      `https://api.slipok.com/api/line/apikey/${process.env.BRANCH_ID}`,
                      {
                        data: qrData,
                        log: true,
                        amount: Number(error.response.data.transaction.price),
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
                      try {
                        const guild = interaction.guild;
                        const member = await guild!.members.fetch(m.author.id);
                        const role = guild!.roles.cache.find(
                          (r) =>
                            r.name ===
                            `${error.response.data.transaction.courseCode}`
                        );

                        if (role) {
                          await member.roles.add(role);
                          await dmChannel.send(
                            `🎉 เพิ่มยศ "${role.name}" สำเร็จแล้ว! กรุณาตรวจสอบในเซิร์ฟเวอร์หลัก`
                          );
                        } else {
                          await dmChannel.send(
                            `⚠️ ไม่พบยศ "${error.response.data.transaction.courseCode}" ในเซิร์ฟเวอร์ กรุณาติดต่อแอดมิน`
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
                } else {
                  await dmChannel.send(
                    `❌ ไม่พบ QR Code ในรูปภาพ กรุณาส่งสลิปที่ชัดเจนอีกครั้ง`
                  );
                }
              } catch (error) {
                await dmChannel.send(`❌ เกิดข้อผิดพลาดในการอ่านสลิป`);
                console.error("QR Scan Error:", error);
              }

              dmCollector.stop("done");
            });
          }
          collector?.on("collect", async (buttonInteraction) => {
            activeCollectors.delete(interaction.user.id);
            if (!buttonInteraction.isButton()) return;
            await handleUploadSlip(buttonInteraction);
          });
        }
      }
    } else if (interaction.customId.startsWith("Discounted_Code_yes")) {
      const modal = new ModalBuilder()
        .setCustomId("discountModal_" + interaction.customId.split("_")[3])
        .setTitle("กรอกรหัสส่วนลด");

      const discountInput = new TextInputBuilder()
        .setCustomId("discountCode")
        .setLabel("รหัสส่วนลดของคุณ")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("เช่น SAVE20");

      const firstActionRow =
        new ActionRowBuilder<TextInputBuilder>().addComponents(discountInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    } else if (interaction.customId.startsWith("Discounted_Code_No")) {
      const transaction = await axios.get(
        `${API_BASE_URL}/transaction/getTransactionByUsernameAndCourse`,
        {
          params: {
            username: interaction.user.username,
            courseCode: interaction.customId.split("_")[3],
          },
        }
      );
      console.log(transaction.data.id);

      const response_QR = await axios.post(
        `${API_BASE_URL}/transaction/createQrCode`,
        {
          transactionId: transaction.data.id,
        }
      );
      const qrBuffer = await QRCode.toBuffer(response_QR.data.qrCodeData);
      const qrAttachment = new AttachmentBuilder(qrBuffer, {
        name: "qrcode.png",
      });
      const qrCodeUrl = await QRCode.toDataURL(response_QR.data.qrCodeData);
      const price = Number(transaction.data.price).toLocaleString("th-TH");

      const embed = {
        color: 0x00bfff,
        title: "!! ธุรกรรมรอดำเนินการ  !!",
        description: [
          "กรุณาชำระเงินโดยสแกน QR Code ด้านล่างผ่านแอปธนาคารของคุณ",
          "",
          "🕒 *หลังจากชำระเงินแล้ว โปรดกดปุ่มอัปโหลดสลิปการชำระเงินจะมีเวลาแค่ ",
          "**10 นาที** ในการ upload โปรดชำระเงินก่อนและค่อยกด!!!*",
          "",
          `**ราคาที่ต้องชำระ:** ฿${price}`,
        ].join("\n"),
        image: { url: "attachment://qrcode.png" },
        footer: { text: "ระบบชำระเงินอัตโนมัติ BennyBot" },
        timestamp: new Date().toISOString(),
      };
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

      const filter = (
        i:
          | ButtonInteraction
          | StringSelectMenuInteraction
          | UserSelectMenuInteraction
          | RoleSelectMenuInteraction
          | MentionableSelectMenuInteraction
          | ChannelSelectMenuInteraction
      ) => {
        return (
          i.isButton() &&
          i.customId === "upload_slip" &&
          i.user.id === interaction.user.id
        );
      };

      const activeCollectors = new Map<string, any>();
      if (activeCollectors.has(interaction.user.id)) {
        activeCollectors.get(interaction.user.id).stop("new_interaction");
      }
      const collector = interaction.channel?.createMessageComponentCollector({
        filter,
        max: 1,
        time: 600_000,
      });
      activeCollectors.set(interaction.user.id, collector);
      async function handleUploadSlip(interaction: ButtonInteraction) {
        const user: User = interaction.user;

        let dmChannel: DMChannel;
        try {
          dmChannel = await user.createDM();
        } catch (err) {
          await interaction.reply({
            content: "❌ ไม่สามารถส่ง DM ให้คุณได้ กรุณาเปิด DM กับ bot ก่อน",
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: "กรุณาเช็ก DM และดำเนินการอัปโหลดสลิปผ่าน DM ส่วนตัวกับ Bot",
          ephemeral: true,
        });

        const duration = 600;
        let remaining = duration;

        const sentMessage = await dmChannel.send(
          `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
        );

        const interval = setInterval(async () => {
          remaining--;
          try {
            await sentMessage.edit(
              `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
            );
          } catch {
            clearInterval(interval);
          }
          if (remaining <= 0) {
            clearInterval(interval);
            try {
              await sentMessage.edit(
                "❌ หมดเวลาการอัปโหลดสลิป กรุณาดำเนินการใหม่อีกครั้ง โดย /menu ใหม่ที่เซิร์ฟเวอร์หลัก"
              );
            } catch {}
            dmCollector.stop("time");
          }
        }, 1000);
        const dmCollector = dmChannel.createMessageCollector({
          filter: (m) => m.author.id === user.id && m.attachments.size > 0,
          time: 600_000,
          max: 1,
        });

        dmCollector.on("collect", async (m: Message) => {
          clearInterval(interval);
          dmCollector.stop("time");
          const slip = m.attachments.first();

          if (!slip) return;
          await dmChannel.send(`⏳ กำลังตรวจสอบสลิป...`);

          try {
            const image = await loadImage(slip.url);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);

            const imageData = ctx.getImageData(0, 0, image.width, image.height);

            const qrCode = jsQR(
              imageData.data,
              imageData.width,
              imageData.height
            );

            if (qrCode) {
              const qrData = qrCode.data;

              try {
                const verifyResponse = await axios.post(
                  `https://api.slipok.com/api/line/apikey/${process.env.BRANCH_ID}`,
                  {
                    data: qrData,
                    log: true,
                    amount: Number(transaction.data.price),
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
                  axios.put(`${API_BASE_URL}/transaction/updatePaymentStatus`, {
                    id: transaction.data.id,
                    paid: true,
                  });
                  try {
                    const guild = interaction.guild;
                    const member = await guild!.members.fetch(m.author.id);
                    const role = guild!.roles.cache.find(
                      (r) => r.name === `${transaction.data.courseCode}`
                    );

                    if (role) {
                      await member.roles.add(role);
                      await dmChannel.send(
                        `🎉 เพิ่มยศ "${role.name}" สำเร็จแล้ว! กรุณาตรวจสอบในเซิร์ฟเวอร์หลัก`
                      );
                    } else {
                      await dmChannel.send(
                        `⚠️ ไม่พบยศ "${transaction.data.courseCode}" ในเซิร์ฟเวอร์ กรุณาติดต่อแอดมิน`
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
            } else {
              await dmChannel.send(
                `❌ ไม่พบ QR Code ในรูปภาพ กรุณาส่งสลิปที่ชัดเจนอีกครั้ง`
              );
            }
          } catch (error) {
            await dmChannel.send(`❌ เกิดข้อผิดพลาดในการอ่านสลิป`);
            console.error("QR Scan Error:", error);
          }

          dmCollector.stop("done");
        });
      }
      collector?.on("collect", async (buttonInteraction) => {
        activeCollectors.delete(interaction.user.id);
        if (!buttonInteraction.isButton()) return;
        await handleUploadSlip(buttonInteraction);
      });
    }
  } else if (interaction.isModalSubmit()) {
    const modalInteraction: ModalSubmitInteraction = interaction;
    if (modalInteraction.customId.startsWith("discountModal_")) {
      const discountCode =
        modalInteraction.fields.getTextInputValue("discountCode");
      const url = `${API_BASE_URL}/discount/${discountCode}`;
      try {
        const response = await axios.get(url);
        const discount = response.data;
        if (discount.used == true) {
          await modalInteraction.reply({
            content: "❌ รหัสส่วนลดนี้ถูกใช้ไปแล้ว กรุณาลองใหม่อีกครั้ง",
            ephemeral: true,
          });
          return;
        }
        discount.used = true;
        await axios.put(`${API_BASE_URL}/discount/`, discount);

        await axios.put(`${API_BASE_URL}/transaction/updateDiscountPrice`, {
          code: discount.code,
          price: discount.discount_price,
          username: modalInteraction.user.username,
          courseCode: modalInteraction.customId.split("_")[1],
        });

        const transaction = await axios.get(
          `${API_BASE_URL}/transaction/getTransactionByUsernameAndCourse`,
          {
            params: {
              username: modalInteraction.user.username,
              courseCode: modalInteraction.customId.split("_")[1],
            },
          }
        );

        const response_QR = await axios.post(
          `${API_BASE_URL}/transaction/createQrCode`,
          {
            transactionId: transaction.data.id,
          }
        );
        const qrBuffer = await QRCode.toBuffer(response_QR.data.qrCodeData);
        const qrAttachment = new AttachmentBuilder(qrBuffer, {
          name: "qrcode.png",
        });
        const qrCodeUrl = await QRCode.toDataURL(response_QR.data.qrCodeData);
        const price = Number(transaction.data.price).toLocaleString("th-TH");

        const embed = {
          color: 0x00bfff,
          title: "!! ธุรกรรมรอดำเนินการ  !!",
          description: [
            `คุณได้รับส่วนลด ${discount.discount_price} บาท`,
            "กรุณาชำระเงินโดยสแกน QR Code ด้านล่างผ่านแอปธนาคารของคุณ",
            "",
            "🕒 *หลังจากชำระเงินแล้ว โปรดกดปุ่มอัปโหลดสลิปการชำระเงินจะมีเวลาแค่ ",
            "**10 นาที** ในการ upload โปรดชำระเงินก่อนและค่อยกด!!!*",
            "",
            `**ราคาที่ต้องชำระ:** ฿${price}`,
          ].join("\n"),
          image: { url: "attachment://qrcode.png" },
          footer: { text: "ระบบชำระเงินอัตโนมัติ BennyBot" },
          timestamp: new Date().toISOString(),
        };
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("upload_slip")
            .setLabel("อัปโหลดสลิปการชำระเงิน")
            .setStyle(ButtonStyle.Success)
        );

        await modalInteraction.reply({
          embeds: [embed],
          files: [qrAttachment],
          components: [row],
          ephemeral: true,
        });

        const filter = (
          i:
            | ButtonInteraction
            | StringSelectMenuInteraction
            | UserSelectMenuInteraction
            | RoleSelectMenuInteraction
            | MentionableSelectMenuInteraction
            | ChannelSelectMenuInteraction
        ) => {
          return (
            i.isButton() &&
            i.customId === "upload_slip" &&
            i.user.id === modalInteraction.user.id
          );
        };

        const activeCollectors = new Map<string, any>();
        if (activeCollectors.has(interaction.user.id)) {
          activeCollectors.get(interaction.user.id).stop("new_interaction");
        }
        const collector =
          modalInteraction.channel?.createMessageComponentCollector({
            filter,
            max: 1,
            time: 600_000,
          });

        activeCollectors.set(interaction.user.id, collector);
        async function handleUploadSlip(modalInteraction: ButtonInteraction) {
          const user: User = modalInteraction.user;

          let dmChannel: DMChannel;
          try {
            dmChannel = await user.createDM();
          } catch (err) {
            await modalInteraction.reply({
              content: "❌ ไม่สามารถส่ง DM ให้คุณได้ กรุณาเปิด DM กับ bot ก่อน",
              ephemeral: true,
            });
            return;
          }

          await modalInteraction.reply({
            content:
              "กรุณาเช็ก DM และดำเนินการอัปโหลดสลิปผ่าน DM ส่วนตัวกับ Bot",
            ephemeral: true,
          });

          const duration = 600;
          let remaining = duration;

          const sentMessage = await dmChannel.send(
            `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
          );

          const interval = setInterval(async () => {
            remaining--;
            try {
              await sentMessage.edit(
                `📎 กรุณาอัปโหลดสลิปโดยส่งภาพมาที่ DM ส่วนตัวของ bot ตัวนี้ภายใน ${remaining} วินาที!`
              );
            } catch {
              clearInterval(interval);
            }
            if (remaining <= 0) {
              clearInterval(interval);
              try {
                await sentMessage.edit(
                  "❌ หมดเวลาการอัปโหลดสลิป กรุณาดำเนินการใหม่อีกครั้ง โดย /menu ใหม่ที่เซิร์ฟเวอร์หลัก"
                );
              } catch {}
              dmCollector.stop("time");
            }
          }, 1000);
          const dmCollector = dmChannel.createMessageCollector({
            filter: (m) => m.author.id === user.id && m.attachments.size > 0,
            time: 600_000,
            max: 1,
          });

          dmCollector.on("collect", async (m: Message) => {
            clearInterval(interval);
            dmCollector.stop("time");
            const slip = m.attachments.first();

            if (!slip) return;
            await dmChannel.send(`⏳ กำลังตรวจสอบสลิป...`);

            try {
              const image = await loadImage(slip.url);
              const canvas = createCanvas(image.width, image.height);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(image, 0, 0);

              const imageData = ctx.getImageData(
                0,
                0,
                image.width,
                image.height
              );

              const qrCode = jsQR(
                imageData.data,
                imageData.width,
                imageData.height
              );

              if (qrCode) {
                const qrData = qrCode.data;

                try {
                  const verifyResponse = await axios.post(
                    `https://api.slipok.com/api/line/apikey/${process.env.BRANCH_ID}`,
                    {
                      data: qrData,
                      log: true,
                      amount: Number(transaction.data.price),
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
                    axios.put(
                      `${API_BASE_URL}/transaction/updatePaymentStatus`,
                      {
                        id: transaction.data.id,
                        paid: true,
                      }
                    );
                    try {
                      const guild = modalInteraction.guild;
                      const member = await guild!.members.fetch(m.author.id);
                      const role = guild!.roles.cache.find(
                        (r) => r.name === `${transaction.data.courseCode}`
                      );

                      if (role) {
                        await member.roles.add(role);
                        await dmChannel.send(
                          `🎉 เพิ่มยศ "${role.name}" สำเร็จแล้ว! กรุณาตรวจสอบในเซิร์ฟเวอร์หลัก`
                        );
                      } else {
                        await dmChannel.send(
                          `⚠️ ไม่พบยศ "${transaction.data.courseCode}" ในเซิร์ฟเวอร์ กรุณาติดต่อแอดมิน`
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
              } else {
                await dmChannel.send(
                  `❌ ไม่พบ QR Code ในรูปภาพ กรุณาส่งสลิปที่ชัดเจนอีกครั้ง`
                );
              }
            } catch (error) {
              await dmChannel.send(`❌ เกิดข้อผิดพลาดในการอ่านสลิป`);
              console.error("QR Scan Error:", error);
            }

            dmCollector.stop("done");
          });
        }
        collector?.on("collect", async (buttonInteraction) => {
          activeCollectors.delete(interaction.user.id);
          if (!buttonInteraction.isButton()) return;
          await handleUploadSlip(buttonInteraction);
        });
      } catch (error: any) {
        await modalInteraction.reply({
          content: "❌ รหัสส่วนลดไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
          ephemeral: true,
        });
        console.error("Discount Code Error:", error.message);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
