// Measured from 51_17.2_My_profile.jpeg. Every card has its title baseline 32 px below the card top and 18 px of
// padding under its content; SectionCard uses 16 px and 20 px, so the cards set the measured values.
export const cardClass = "pt-[14.5px] pb-[18px]";

/** 12.5 px bold slate field labels, 6 px above the 42 px field. */
export const fieldClass = "gap-1.5";
export const labelClass = "text-[12.5px] leading-[15px] font-bold text-label";

/** The reference inputs set 14 px text 12 px from the border (Input default: 15 px, 14 px). */
export const inputClass = "px-3 text-sm";

/** Setting rows: 14 px bold title over a 12.5 px muted line, 14 px between baselines. */
export const rowTitleClass = "text-sm leading-4 font-bold";
export const rowDetailClass = "text-[12.5px] leading-[13px] text-muted-foreground";

/** Outline buttons in the cards: slate text and the input-coloured border (#d2d4e1) of the reference. */
export const outlineButtonClass = "border-input text-label";
