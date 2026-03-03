import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-left"
      toastOptions={{
        duration: 3000,
        style: {
          fontFamily: 'Heebo, system-ui, sans-serif',
          direction: 'rtl',
          borderRadius: '16px',
          padding: '14px 18px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        },
        success: {
          style: {
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
          },
        },
        error: {
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          },
        },
      }}
    />
  );
}
