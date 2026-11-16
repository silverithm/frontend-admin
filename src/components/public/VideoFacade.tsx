'use client';

// 유튜브 영상 칸 — 처음에는 썸네일 + 재생 단추만 두고, 누르면 그때 iframe(autoplay)을 붙인다.
// iframe을 처음부터 올리지 않아 첫 화면이 가볍고, 유튜브가 막혀 있어도 빈 회색 상자가 되지 않는다.

import React, { useState } from 'react';
import '@/styles/public.css';

export default function VideoFacade({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        style={{ width: '100%', height: '100%', border: 0 }}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <div className="carev-video">
      <button type="button" className="carev-video-play" aria-label={`영상 재생: ${title}`} onClick={() => setPlaying(true)}>
        {/* next/image 허용 도메인에 없는 외부 썸네일이라 일반 img */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
        <span className="carev-video-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
      </button>
    </div>
  );
}
