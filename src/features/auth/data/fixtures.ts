// Prefilled form values transcribed from the auth references (D1). Sign in (01_1) has no data: its fields are empty.

/** 02_1.1_Forgot_password.jpeg: the email field is filled. */
export const forgotPassword = { email: "name@mrgarments.com" };

/**
 * 03_1.2_Change_password.jpeg: 10 masked characters in Current, 12 in New and Confirm. The new password has 12
 * characters and a number but no capital letter, so the meter shows 3 of 4 segments with 2 of 3 rules met.
 */
export const changePassword = {
  current: "tracking26",
  next: "garments2026",
  confirm: "garments2026",
};
