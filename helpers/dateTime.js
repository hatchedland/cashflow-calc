export function getUnixTimestampFourYearsLater() {
  const currentDate = new Date();
  const fourYearsLater = new Date(currentDate.getFullYear() + 4, currentDate.getMonth(), currentDate.getDate());
  return Math.floor(fourYearsLater.getTime() / 1000);
}

export function getUnixTimestampThreeYearsLater() {
  const currentDate = new Date();
  const threeYearsLater = new Date(currentDate.getFullYear() + 3, currentDate.getMonth(), currentDate.getDate());
  return Math.floor(threeYearsLater.getTime() / 1000);
}


export function formatForInvestmentReport(timestamp) {
  // If timestamp is too large, assume it's in milliseconds
  if (timestamp > 1e10) {
    timestamp = Math.floor(timestamp / 1000); // Convert to seconds
  }

  const date = new Date(timestamp * 1000); // Ensure timestamp is in milliseconds

  const day = date.getDate(); // Using local date instead of UTC
  const month = date.toLocaleString("en-US", {
    month: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const year = date.getFullYear(); // Using local year instead of UTC

  return `${year}-${month}-${day}`;
}
