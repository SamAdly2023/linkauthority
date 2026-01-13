<div align="center">
  <img src="https://www.linkauthority.live/link-authority-logo.png" alt="LinkAuthority Logo" width="100" />
  <h1>LinkAuthority</h1>
  <p><strong>The #1 Marketplace for High-Quality Backlinks & AI SEO Analysis</strong></p>
</div>

LinkAuthority is a comprehensive platform that connects website owners to exchange high-quality backlinks, improving their Domain Authority (DA) and search engine rankings. It points-based economy and leverages Google's Gemini AI to provide expert SEO advice and technical audits.

## 🚀 Key Features

### 🔗 Link Marketplace
- **Earn Points**: Accept link requests from other users and place them on your verified sites.
- **Spend Points**: User your earned points to buy high-quality backlinks from other verified sites in your niche.
- **Smart Matching**: Filter sites by category, DA, and location (Local/Worldwide).

### 🧠 AI SEO Expert (Powered by Gemini)
- **Detailed Reports**: Generate professional SEO reports for your websites.
- **Technical Audit**: Automated checks for performance, accessibility, and best practices.
- **Strategic Advice**: Get AI-tailored strategies for backlink acquisition and anchor text usage.

### 🤖 Automation & Integrations
- **GoHighLevel Integration**: Seamlessly syncs new user signups and sends transactional emails (Welcome, Verification, Link Requests) via GHL workflows.
- **Google Auth**: Secure and fast login via Google OAuth 2.0.
- **PayPal Integration**: Secure payment processing for point purchases.

### 🛡️ Security & SEO
- **Enterprise-Grade Security**: Protected against XSS, NoSQL Injection, Parameter Pollution, and DDOS (Rate Limiting).
- **Technical SEO**: Fully optimized with dynamic Meta Tags, JSON-LD Structured Data, Sitemap.xml, and Robots.txt.
- **Trust Verification**: Domain ownership verification via DNS TXT records.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide React
- **SEO Engine**: React Helmet Async, Schema.org JSON-LD
- **Backend**: Node.js, Express, MongoDB
- **Security**: Helmet, XSS-Clean, HPP, Express Rate Limit, Mongo Sanitize
- **AI**: Google Gemini Pro (via `@google/genai`)
- **Email/CRM**: GoHighLevel Webhooks

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB URI
- Google Cloud Project (OAuth Credentials + Gemini API)
- GoHighLevel Account (Optional, for emails)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SamAdly2023/linkauthority.git
   cd linkauthority
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

### Configuration

Create a `.env` file in the root directory (or `.env.local` for Vite) and add your API keys:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

*Note: Backend configuration might require additional `.env` setup in the `server/` directory.*

### Running the App

1. **Start the Frontend**
   ```bash
   npm run dev
   ```

2. **Start the Backend** (in a separate terminal)
   ```bash
   cd server
   npm start
   ```

## 📂 Project Structure

```
linkauthority/
├── src/
│   ├── components/     # React components
│   ├── services/       # API and AI services (geminiService.ts)
│   ├── types.ts        # TypeScript interfaces
│   └── App.tsx         # Main application logic
├── server/             # Backend Node.js/Express server
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   └── services/       # Backend services
└── public/             # Static assets
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
