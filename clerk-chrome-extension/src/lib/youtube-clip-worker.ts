import {
  buildYouTubeClipCommand,
  type CreateYouTubeClipRequest,
  type YouTubeClipJob
} from "./youtube-clip"

const youtubeClipJobs = new Map<string, YouTubeClipJob>()

let nextYouTubeClipJobId = 1

const createYouTubeClipJobId = () =>
  `youtube-clip-${nextYouTubeClipJobId++}`

export const createYouTubeClipJob = async (
  request: CreateYouTubeClipRequest
): Promise<YouTubeClipJob> => {
  const baseJob: YouTubeClipJob = {
    id: createYouTubeClipJobId(),
    status: "creating",
    command: null,
    createdAt: new Date().toISOString()
  }

  youtubeClipJobs.set(baseJob.id, baseJob)

  try {
    const completedJob: YouTubeClipJob = {
      ...baseJob,
      status: "success",
      command: buildYouTubeClipCommand(request)
    }

    youtubeClipJobs.set(completedJob.id, completedJob)
    return completedJob
  } catch (error) {
    const failedJob: YouTubeClipJob = {
      ...baseJob,
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "Failed to create YouTube clip."
    }

    youtubeClipJobs.set(failedJob.id, failedJob)
    return failedJob
  }
}

export const getYouTubeClipJobStatus = async (
  id: string
): Promise<YouTubeClipJob | null> => youtubeClipJobs.get(id) ?? null
