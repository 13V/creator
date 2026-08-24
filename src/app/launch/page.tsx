import { LaunchForm } from "@/components/LaunchForm";

export const metadata = { title: "Launch a coin" };

export default function LaunchPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="card iridescent p-5 sm:p-7">
        <LaunchForm />
      </div>
    </div>
  );
}
