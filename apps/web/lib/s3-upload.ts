/**
 * Lightweight XMLHttpRequest wrapper to stream raw binary files directly to Amazon S3.
 * Uses XHR instead of fetch to provide smooth, real-time byte upload progress feedback.
 */
export function uploadBinaryToS3(
  presignedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Amazon S3 rejected upload lease with HTTP ${xhr.status} (${xhr.statusText})`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network failure occurred during direct S3 binary transfer."));
    };

    xhr.send(file);
  });
}
