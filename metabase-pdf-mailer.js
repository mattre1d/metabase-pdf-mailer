const { setTimeout } = require("node:timers/promises");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const argv = yargs(hideBin(process.argv))
  .option("url", {
    alias: "u",
    type: "string",
    description: "Metabase Dashboard Public URL",
    default: process.env.METABASE_URL || "",
    demandOption: !process.env.METABASE_URL,
  })
  .option("title", {
    alias: "t",
    type: "string",
    description: "Report title",
    default: process.env.REPORT_TITLE || "Report",
  })
  .option("date", {
    type: "string",
    description: "Custom date to display",
    default: process.env.REPORT_DATE || "",
  })
  .option("logo", {
    alias: "l",
    type: "string",
    description: "Path to logo image",
    default: process.env.LOGO_PATH || null, 
  })
  .option("waittime", {
    alias: "w",
    type: "number",
    description: "Time to wait for dashboard to load (ms)",
    default: parseInt(process.env.WAIT_TIME) || 3000,
  })
  .option("email", {
    alias: "e",
    type: "boolean",
    description: "Send PDF by email",
    default: process.env.SEND_EMAIL === "true" || false,
  })
  .option("from", {
    type: "string",
    description: "Email sender address",
    default: process.env.EMAIL_FROM || "reports@example.com",
  })
  .option("to", {
    type: "string",
    description: "Email recipient(s), comma-separated",
    default: process.env.EMAIL_TO || "",
  })
  .option("subject", {
    type: "string",
    description: "Email subject",
    default: process.env.EMAIL_SUBJECT || "",
  })
  .option("body", {
    type: "string",
    description: "Email body text",
    default: process.env.EMAIL_BODY || "Please find the attached report.",
  })
  .option("smtphost", {
    type: "string",
    description: "SMTP server hostname or IP",
    default: process.env.SMTP_HOST || "localhost",
  })
  .option("smtpport", {
    type: "number",
    description: "SMTP server port",
    default: parseInt(process.env.SMTP_PORT) || 25,
  })
  .help().argv;

async function generateMetabasePdf() {
  let browser;
  let pdfPath = '';

  try {
    if (!argv.url) {
      throw new Error("Metabase dashboard URL is required");
    }

    let formattedDate = argv.date;
    let dateForFileName = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!formattedDate) {
      const now = new Date();
      formattedDate = `${String(now.getDate()).padStart(2, "0")}/${String(
        now.getMonth() + 1
      ).padStart(2, "0")}/${now.getFullYear()}`;
    }

    // Generate PDF filename based on title and date
    const fileName = `${argv.title} ${dateForFileName}.pdf`;
    const reportsDir = process.env.REPORTS_DIR || process.cwd();
    pdfPath = path.resolve(reportsDir, fileName);

    // Get logo as base64
    let logoBase64 = "";
    if (argv.logo) {
      const logoPath = path.resolve(argv.logo);
      try {
        if (fs.existsSync(logoPath)) {
          const logoData = fs.readFileSync(logoPath);
          const logoExtension = path.extname(logoPath).substring(1);
          logoBase64 = `data:image/${logoExtension};base64,${logoData.toString("base64")}`;
        }
      } catch (error) {
        console.warn(`Logo error: ${error.message}`);
      }
    }

    // Setup browser
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    // Create download directory
    const downloadPath = path.resolve(process.env.DOWNLOAD_DIR || process.cwd(), 'downloads');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    // Setup page
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
    
    // Navigate to dashboard
    console.log(`Loading ${argv.url}...`);
    await page.goto(argv.url, { waitUntil: "networkidle2", timeout: 60000 });
    await setTimeout(argv.waittime);

    // Add header customization
    await page.evaluate((title, date, logoBase64) => {
      new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.addedNodes) {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType !== 1) return; 
              
              // Check if this is a header element
              if ((node.tagName === 'DIV' || node.tagName === 'HEADER') && 
                  (node.style.fontFamily?.includes('Lato') ||
                   node.style.borderBottom?.includes('var(--mb-color-border)') ||
                   node.className?.includes('header') ||
                   node.id?.includes('header'))) {
                
                // Replace with our custom header
                const customHeader = document.createElement('div');
                customHeader.style.cssText = 
                  "display:flex;justify-content:space-between;align-items:center;" +
                  "color:black;font-size:18px;font-weight:300;height:3rem;";
                node.style.borderBottom = 'none';
                const titleSection = document.createElement('div');
                titleSection.innerHTML = `<h2>${title}</h2><span>${date}</span>`;
                const logoSection = document.createElement('div');
                if (logoBase64) {
                  logoSection.innerHTML = 
                    `<img src="${logoBase64}" alt="Logo" style="height:80px;vertical-align:middle;">`;
                }
                customHeader.appendChild(titleSection);
                customHeader.appendChild(logoSection);
                node.innerHTML = '';
                node.appendChild(customHeader);
              }
            });
          }
        });
      }).observe(document.body, { childList: true, subtree: true });
    }, argv.title, formattedDate, logoBase64);

    // Click export button
    console.log("Clicking export button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Try by text content first
      const exportButton = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('export') && text.includes('pdf');
      });
      
      if (exportButton) {
        exportButton.click();
        return;
      }
      
      // Try by icon if text search failed
      const buttonWithIcon = buttons.find(btn => {
        return btn.querySelector('.Icon-document') || 
               btn.querySelector('svg.Icon-document') ||
               btn.innerHTML.includes('document');
      });
      
      if (buttonWithIcon) {
        buttonWithIcon.click();
        return;
      }
      
      throw new Error("Export button not found");
    });

    // Wait for PDF generation and download
    await setTimeout(5000);
    console.log("Waiting for download to complete...");
    
    // Check for downloaded file
    let downloadedFileName = null;
    const startTime = Date.now();
    
    while (Date.now() - startTime < 30000) {
      const files = fs.readdirSync(downloadPath).filter(file => 
        file.endsWith('.pdf') && 
        !file.endsWith('.crdownload') && 
        !file.endsWith('.part')
      );
      
      if (files.length > 0) {
        downloadedFileName = files[0];
        break;
      }
      
      await setTimeout(500);
    }
    
    if (!downloadedFileName) {
      throw new Error("PDF download timed out or failed");
    }
    
    // Move the file to output location
    const downloadedFilePath = path.join(downloadPath, downloadedFileName);
    fs.copyFileSync(downloadedFilePath, pdfPath);
    fs.unlinkSync(downloadedFilePath);
    
    console.log(`PDF report saved to: ${pdfPath}`);
    
    // Send email
    if (argv.email && argv.to) {
      await sendEmailWithNodemailer(pdfPath, fileName);
      console.log("Email sent successfully");
      
      // Delete PDF after sending
      if (process.env.DELETE_AFTER_EMAIL === "true") {
        fs.unlinkSync(pdfPath);
        console.log("PDF file deleted after sending email");
      }
    }
    
    return pdfPath;
  } catch (error) {
    console.error("Error generating PDF report:", error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function sendEmailWithNodemailer(pdfPath, fileName) {
  try {
    const subject = argv.subject || `${argv.title} Report`;
    const recipients = argv.to;
    const sender = argv.from;
    const body = argv.body;
    
    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: argv.smtphost,
      port: argv.smtpport,
      secure: false,
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log(`Connecting to SMTP server at ${argv.smtphost}:${argv.smtpport}...`);
    await transporter.verify();
    console.log("SMTP connection established");
    
    // Configure email
    const mailOptions = {
      from: sender,
      to: recipients,
      subject: subject,
      text: body,
      attachments: [
        {
          filename: fileName,
          path: pdfPath
        }
      ]
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

if (require.main === module) {
  generateMetabasePdf();
}

module.exports = { generateMetabasePdf };