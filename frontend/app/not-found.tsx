import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <h2 className="text-4xl font-black text-gray-900 mb-4">404</h2>
      <p className="text-xl font-bold text-gray-600 mb-8">Page Not Found</p>
      <Link href="/" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
        Return Home
      </Link>
    </div>
  );
}
