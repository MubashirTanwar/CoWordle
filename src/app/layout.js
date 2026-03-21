import './globals.css';

export const metadata = {
  title: 'CoWordle — Multiplayer Wordle',
  description: 'Play Wordle with friends in real-time',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#121213] text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
