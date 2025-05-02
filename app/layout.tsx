import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Type definitions
type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// Validate environment variables and set default URL
const getBaseUrl = (): string => {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
};

// Configure metadata
export const metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: "AI PDF Challenge",
  description: "AI-powered PDF processing application",
  icons: {
    icon: '/favicon.ico',
  },
};

// Configure font
const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

/**
 * Root layout component that wraps the entire application
 * Provides theme support and basic layout structure
 * 
 * @param props.children The child components to render
 * @returns The root layout component
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col items-center">
              {children}
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}