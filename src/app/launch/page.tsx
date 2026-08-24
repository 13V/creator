import { LaunchForm } from "@/components/LaunchForm";

export const metadata = { title: "Launch a coin" };

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <LaunchForm />
    </div>
  );
}
