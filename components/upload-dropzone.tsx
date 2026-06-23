"use client";

export function UploadDropzone() {
  return (
    <form className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-white p-5">
      <label htmlFor="meeting-audio" className="text-sm font-medium">
        Upload MP3
      </label>
      <input
        id="meeting-audio"
        name="meeting-audio"
        type="file"
        accept="audio/mpeg"
        className="text-sm"
      />
      <button
        type="button"
        className="w-fit rounded-md bg-[var(--text)] px-4 py-2 text-sm font-medium text-white"
      >
        Upload
      </button>
    </form>
  );
}
