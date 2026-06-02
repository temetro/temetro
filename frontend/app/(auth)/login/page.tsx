import { AuthLayout } from "@/components/auth/auth-ui";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
