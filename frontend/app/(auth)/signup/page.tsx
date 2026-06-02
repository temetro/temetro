import { AuthLayout } from "@/components/auth/auth-ui";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
