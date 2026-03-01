import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

export interface TrackedFace {
    id: number;
    centroid: { x: number; y: number };
    box: { origin_x: number; origin_y: number; width: number; height: number };
    lastSeenFrame: number;
    jawOpen: number;
}

interface FaceTrackingOptions {
    staticFallback?: boolean;
    distanceThreshold?: number;
    staleFramesConfig?: number;
}

export function useFaceTracking(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    options: FaceTrackingOptions = {}
) {
    const { staticFallback = false, distanceThreshold = 0.2, staleFramesConfig = 30 } = options;

    const [activeFaces, setActiveFaces] = useState<TrackedFace[]>([]);
    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const registryRef = useRef<Map<number, TrackedFace>>(new Map());
    const nextIdRef = useRef<number>(1);
    const frameCountRef = useRef<number>(0);
    const reqFrameRef = useRef<number>(0);
    const lastProcessedTimeRef = useRef<number>(-1);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm"
                );
                if (!active) return;
                const landmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 5,
                    outputFaceBlendshapes: true,
                });
                if (active) landmarkerRef.current = landmarker;
            } catch (err) {
                console.error("FaceLandmarker init failed, retrying on CPU...", err);
                try {
                    const vision = await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm"
                    );
                    const landmarker = await FaceLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                            delegate: "CPU"
                        },
                        runningMode: "VIDEO",
                        numFaces: 5,
                        outputFaceBlendshapes: true,
                    });
                    if (active) landmarkerRef.current = landmarker;
                } catch (inner) {
                    console.error("FaceLandmarker fallback also failed", inner);
                }
            }
        })();
        return () => {
            active = false;
            landmarkerRef.current?.close();
        };
    }, []);

    const detectFaces = useCallback(() => {
        if (!videoRef.current || !landmarkerRef.current || videoRef.current.readyState < 2) {
            reqFrameRef.current = requestAnimationFrame(detectFaces);
            return;
        }

        const video = videoRef.current;
        if (video.currentTime === lastProcessedTimeRef.current || video.paused) {
            reqFrameRef.current = requestAnimationFrame(detectFaces);
            return;
        }
        lastProcessedTimeRef.current = video.currentTime;

        try {
            const results = landmarkerRef.current.detectForVideo(video, video.currentTime * 1000);
            frameCountRef.current += 1;
            const currentFrame = frameCountRef.current;

            const facesOutput: TrackedFace[] = [];

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const detectedFaces = results.faceLandmarks.map((landmarks, index) => {
                    let minX = 1, minY = 1, maxX = 0, maxY = 0;
                    for (const lm of landmarks) {
                        if (lm.x < minX) minX = lm.x;
                        if (lm.y < minY) minY = lm.y;
                        if (lm.x > maxX) maxX = lm.x;
                        if (lm.y > maxY) maxY = lm.y;
                    }

                    let jawOpen = 0;
                    if (results.faceBlendshapes && results.faceBlendshapes[index]) {
                        const shapes = results.faceBlendshapes[index].categories;
                        const jawOpenCategory = shapes.find(s => s.categoryName === "jawOpen");
                        if (jawOpenCategory) {
                            jawOpen = jawOpenCategory.score;
                        }
                    }

                    const box = {
                        origin_x: minX,
                        origin_y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                    const centroid = {
                        x: minX + box.width / 2,
                        y: minY + box.height / 2
                    };
                    return { box, centroid, jawOpen };
                });

                if (staticFallback) {
                    detectedFaces.sort((a, b) => a.box.origin_x - b.box.origin_x);
                    detectedFaces.forEach((f, i) => {
                        const id = i + 1;
                        const newFace: TrackedFace = {
                            id,
                            centroid: f.centroid,
                            box: f.box,
                            lastSeenFrame: currentFrame,
                            jawOpen: f.jawOpen
                        };
                        registryRef.current.set(id, newFace);
                        facesOutput.push(newFace);
                    });
                } else {
                    const assignedIds = new Set<number>();

                    detectedFaces.forEach((f) => {
                        let bestId = -1;
                        let minDistance = distanceThreshold;

                        for (const [id, regFace] of registryRef.current.entries()) {
                            if (assignedIds.has(id)) continue;

                            const dx = f.centroid.x - regFace.centroid.x;
                            const dy = f.centroid.y - regFace.centroid.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            if (dist < minDistance) {
                                minDistance = dist;
                                bestId = id;
                            }
                        }

                        if (bestId !== -1) {
                            assignedIds.add(bestId);
                            const updated: TrackedFace = {
                                id: bestId,
                                centroid: f.centroid,
                                box: f.box,
                                lastSeenFrame: currentFrame,
                                jawOpen: f.jawOpen
                            };
                            registryRef.current.set(bestId, updated);
                            facesOutput.push(updated);
                        } else {
                            const newId = nextIdRef.current++;
                            assignedIds.add(newId);
                            const newFace: TrackedFace = {
                                id: newId,
                                centroid: f.centroid,
                                box: f.box,
                                lastSeenFrame: currentFrame,
                                jawOpen: f.jawOpen
                            };
                            registryRef.current.set(newId, newFace);
                            facesOutput.push(newFace);
                        }
                    });
                }
            }

            for (const [id, regFace] of registryRef.current.entries()) {
                if (currentFrame - regFace.lastSeenFrame > staleFramesConfig) {
                    registryRef.current.delete(id);
                }
            }

            setActiveFaces(facesOutput);
        } catch (err) {
            console.error("Face detection loop error:", err);
        }

        reqFrameRef.current = requestAnimationFrame(detectFaces);
    }, [staticFallback, distanceThreshold, staleFramesConfig, videoRef]);

    useEffect(() => {
        reqFrameRef.current = requestAnimationFrame(detectFaces);
        return () => {
            cancelAnimationFrame(reqFrameRef.current);
        };
    }, [detectFaces]);

    return { faces: activeFaces, isReady: landmarkerRef.current !== null };
}
