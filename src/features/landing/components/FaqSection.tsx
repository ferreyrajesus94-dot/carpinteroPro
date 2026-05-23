import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "../data/landingContent";

interface FaqSectionProps {
	faqs: FaqItem[];
}

export function FaqSection({ faqs }: FaqSectionProps) {
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	function toggle(index: number) {
		setOpenIndex((prev) => (prev === index ? null : index));
	}

	return (
		<div className="mx-auto max-w-2xl space-y-3">
			{faqs.map((faq, index) => {
				const isOpen = openIndex === index;
				return (
					<div
						key={faq.question}
						className="rounded-xl border border-line bg-cp-surface overflow-hidden"
					>
						<button
							type="button"
							onClick={() => toggle(index)}
							aria-expanded={isOpen}
							aria-controls={`faq-panel-${index}`}
							className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
						>
							<span className="text-sm font-medium text-ink">
								{faq.question}
							</span>
							<ChevronDown
								className={`h-4 w-4 shrink-0 text-ink2 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
								aria-hidden="true"
							/>
						</button>
						<div
							id={`faq-panel-${index}`}
							className="grid transition-all duration-300 ease-in-out"
							style={{
								gridTemplateRows: isOpen ? "1fr" : "0fr",
							}}
						>
							<div className="overflow-hidden">
								<p className="px-5 pb-4 text-sm leading-relaxed text-ink2">
									{faq.answer}
								</p>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
