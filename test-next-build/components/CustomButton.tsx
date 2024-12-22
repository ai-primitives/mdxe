
import React from 'react'

export default function CustomButton({ children }) {
  return (
    <button className="bg-blue-500 text-white px-4 py-2 rounded">
      {children}
    </button>
  )
}
