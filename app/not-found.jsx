"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-4">
      
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      
      <p className="text-gray-500 mb-6">
        The page you are looking for does not exist.
      </p>

      <div className="flex gap-4">
        <Link href="/store">
          <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
            Go to Store Panel
          </button>
        </Link>

        <Link href="/employee/login">
          <button className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
            Employee Login
          </button>
        </Link>
      </div>
      
    </div>
  );
}