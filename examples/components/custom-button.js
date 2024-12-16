import React from 'react';
export default function Button({ children, onClick, variant = 'primary' }) {
    const baseClasses = 'px-4 py-2 rounded-md font-medium';
    const variantClasses = {
        primary: 'bg-blue-500 text-white hover:bg-blue-600',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
    };
    return (React.createElement("button", { className: `${baseClasses} ${variantClasses[variant]}`, onClick: onClick }, children));
}
//# sourceMappingURL=custom-button.js.map