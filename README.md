<div align="center">
  <h1>LinkAuthority</h1>
  <p><strong>The #1 Marketplace for High-Quality Backlinks & AI SEO Analysis</strong></p>
</div>

LinkAuthority is a comprehensive platform that connects website owners to exchange high-quality backlinks, improving their Domain Authority (DA) and search engine rankings. It features a point-based economy and leverages Google's Gemini AI to provide expert SEO advice and technical audits.

## 🚀 Key Features

### 🔗 Link Marketplace
- **Earn Points**: Accept link requests from other users and place them on your verified sites.
- **Spend Points**: Use your earned points to buy high-quality backlinks from other verified sites in your niche.
- **Smart Matching**: Filter sites by category, DA, and location (Local/Worldwide).

### 🧠 AI SEO Expert (Powered by Gemini)
- **Detailed Reports**: Generate professional SEO reports for your websites.
- **Technical Audit**: Automated checks for performance, accessibility, and best practices.
- **Growth Projections**: Visualize potential traffic and backlink growth.
- **Strategic Advice**: Get AI-tailored strategies for backlink acquisition and anchor text usage.

### 🛡️ Trust & Verification
- **Domain Verification**: Verify ownership via DNS TXT record or HTML file upload.
- **Automated DA Calculation**: System automatically assigns point values based on Domain Authority.
- **Transaction Verification**: Manual and automated verification steps to ensure links are actually placed.

### 📊 Dashboard & Analytics
- **Real-time Stats**: Track your points, transactions, and site performance.
- **Interactive Charts**: Visualizations for traffic and growth.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **UI Components**: Lucide React (Icons), Recharts (Charts)
- **AI Integration**: Google Gemini AI (via `@google/genai`)
- **Backend**: Node.js, Express (in `server/` directory)
- **Database**: MongoDB (implied by Mongoose models)

## 🏁 Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB (for the backend)
- Google Gemini API Key

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
