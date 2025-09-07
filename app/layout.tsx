import "./globals.css";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex flex-col h-15 w-full  bg-black text-white items-center justify-center">
          <h1 className="text-lg font-bold">MY RAG</h1>
        </div>
        {children}
      </body>
    </html>
  );
}
