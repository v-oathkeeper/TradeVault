import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to your TradeVault household account',
};

export default function LoginPage() {
  return <LoginForm />;
}
