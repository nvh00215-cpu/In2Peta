export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-near-black md:flex md:items-stretch">
      {children}
    </div>
  );
}
