import React from 'react';
export default function CustomLayout({ children, meta }) {
    return (React.createElement("div", { className: "max-w-4xl mx-auto py-8 px-4" },
        meta?.title && React.createElement("h1", { className: "text-3xl font-bold mb-4" }, meta.title),
        meta?.description && React.createElement("p", { className: "text-gray-600 mb-8" }, meta.description),
        React.createElement("div", { className: "prose" }, children)));
}
//# sourceMappingURL=custom-layout.js.map