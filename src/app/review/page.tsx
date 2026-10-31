import { ReviewBoard } from "@/components/ReviewBoard";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  return (
    // Breaks out of the site's narrow content column so the review fills the screen.
    <div className="relative left-1/2 w-[92vw] max-w-[1700px] -translate-x-1/2 space-y-6 text-lg leading-relaxed">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">Packaging Expert Review</h1>
        <p className="text-xl text-slate-700">
          Thank you for helping! We built a tool that reads the packaging codes on DLA contracts and explains them in plain English. Please check our work using your
          experience.
        </p>
      </div>
      <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-xl">
        <p className="mb-2 font-bold">How this works</p>
        <ol className="list-decimal space-y-1 pl-7">
          <li>Type your name in the box below.</li>
          <li>Read each question and click the answer that fits.</li>
          <li>
            Press the big green <b>Save my answer</b> button.
          </li>
          <li>The question folds up and gets an &ldquo;ANSWERED&rdquo; stamp. To change it later, click <b>Change my answer</b>.</li>
        </ol>
        <p className="mt-3">
          There are no wrong answers — &ldquo;I&rsquo;m not sure&rdquo; is helpful too. You can stop any time; everything you saved stays saved.
        </p>
      </div>
      <ReviewBoard />
    </div>
  );
}
