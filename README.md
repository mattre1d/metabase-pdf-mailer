# Metabase PDF Report Mailer

A lightweight tool that extracts content from Metabase dashboards and generates custom PDF reports for email delivery.

## Features

- Automatically captures Metabase dashboards
- Customizes PDF header with title, date, and optional logo
- Generates PDF files named with the format "{title}-{date}.pdf"
- Can automatically email reports via SMTP
- Available as a lightweight Docker container

## Installation

### Standard Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

### Docker Installation

#### Using the Docker Image

Pull the pre-built image:

```bash
docker pull mattre1d/metabase-pdf-mailer
```

Or build it yourself:

```bash
docker build -t metabase-pdf-mailer .
```

## Usage

### Command Line

Run the script with the URL of the Metabase dashboard you want to capture:

```bash
node metabase-pdf-mailer.js --url="https://metabase.example.com/public/dashboard/123456" --title="Monthly Sales Report"
```

### Docker

```bash
docker run --rm \
  -v $(pwd)/reports:/app/reports \
  -e METABASE_URL="http://10.136.0.10:3000/public/dashboard/65d5d5e0" \
  -e REPORT_TITLE="OAS Daily Report" \
  metabase-pdf-mailer
```

### Docker Compose

```bash
docker-compose up
```

## Configuration

### Command Line Options

- `--url`, `-u`: Metabase Dashboard Public URL (required)
- `--title`, `-t`: Report title (default: 'Report')
- `--date`: Custom date to display (default: current date in DD/MM/YYYY format)
- `--logo`, `-l`: Path to logo image (default: null)
- `--waittime`, `-w`: Time to wait for dashboard to load in milliseconds (default: 3000)

### Email Options

- `--email`, `-e`: Send PDF by email (flag)
- `--from`: Email sender address (default: 'reports@example.com')
- `--to`: Email recipient(s) comma-separated
- `--subject`: Email subject (default: '{title} Report')
- `--body`: Email body text (default: 'Please find the attached report.')
- `--smtphost`: SMTP server hostname or IP (default: 'localhost')
- `--smtpport`: SMTP server port (default: 25)

### Environment Variables

All command line options can also be set using environment variables:

| Environment Variable | Description |
|---------------------|-------------|
| METABASE_URL | Metabase Dashboard Public URL |
| REPORT_TITLE | Report title |
| REPORT_DATE | Custom date to display |
| LOGO_PATH | Path to logo image |
| WAIT_TIME | Time to wait for dashboard to load (ms) |
| SEND_EMAIL | Set to 'true' to send email |
| EMAIL_FROM | Email sender address |
| EMAIL_TO | Email recipient(s), comma-separated |
| EMAIL_SUBJECT | Email subject |
| EMAIL_BODY | Email body text |
| SMTP_HOST | SMTP server hostname or IP |
| SMTP_PORT | SMTP server port |
| DELETE_AFTER_EMAIL | Set to 'true' to delete PDF after sending |
| REPORTS_DIR | Directory for saving reports |
| DOWNLOAD_DIR | Directory for temporary downloads |

## Examples

### Generate PDF Only

```bash
node metabase-pdf-mailer.js --url="https://metabase.example.com/public/dashboard/123456" --title="Daily Report"
```

### Generate PDF and Send via Email

```bash
node metabase-pdf-mailer.js --url="https://metabase.example.com/public/dashboard/123456" --title="Daily Report" --email --to="user@example.com"
```

### Using Docker with Environment Variables

```bash
docker run --rm \
  -v $(pwd)/reports:/app/reports \
  -e METABASE_URL="https://metabase.example.com/public/dashboard/123456" \
  -e REPORT_TITLE="Daily Report" \
  -e SEND_EMAIL=true \
  -e EMAIL_TO="recipient@example.com" \
  -e SMTP_HOST="127.0.0.1" \
  metabase-pdf-mailer
```

## Automating Reports

### Using Cron with Docker

Create a cron job to run reports on a schedule:

```bash
# Run daily at 7 AM
0 7 * * * docker run --rm -v /path/to/reports:/app/reports -e METABASE_URL="https://metabase.example.com/public/dashboard/123456" -e REPORT_TITLE="Daily Report" -e SEND_EMAIL=true -e EMAIL_TO="team@example.com" -e SMTP_HOST="127.0.0.1" metabase-pdf-mailer > /path/to/logs/report-$(date +\%Y\%m\%d).log 2>&1
```

### Using Docker Compose with Restart Policy

```yaml
services:
  scheduled-reporter:
    image: metabase-pdf-mailer
    restart: unless-stopped
    volumes:
      - ./reports:/app/reports
    environment:
      - METABASE_URL=https://metabase.example.com/public/dashboard/123456
      - REPORT_TITLE=Hourly Report
      - SEND_EMAIL=true
      - EMAIL_TO=team@example.com
      - CRON_SCHEDULE=0 * * * *
```

## Requirements

- Node.js 14.0.0 or higher
- Puppeteer for headless browser automation
- Nodemailer for email delivery
- SMTP server configured for email delivery

## Troubleshooting

If you encounter email delivery issues:
1. Verify your SMTP server configuration
2. Check that the sending server allows relaying to external domains
3. Ensure proper network access between the script host and SMTP server

For Docker-specific issues:
1. Check container logs: `docker logs [container-name]`
2. Ensure volumes are properly mounted
3. Verify environment variables are correctly set

## License

MIT