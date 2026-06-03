import './globals.css'

export const metadata = {
  title: 'mRestApi',
  description: 'A lean, browser-honest HTTP API testing tool.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="h-full">{children}</body>
    </html>
  )
}
