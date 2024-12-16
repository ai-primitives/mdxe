import React from 'react';
interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary';
}
export default function Button({ children, onClick, variant }: ButtonProps): React.JSX.Element;
export {};
//# sourceMappingURL=custom-button.d.ts.map