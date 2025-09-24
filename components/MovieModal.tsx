import React from 'react';
import { Movie } from '../types';

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
  onPlay: () => void;
  onToggleMyList: (movie: Movie) => void;
  isInMyList: boolean;
}

const MovieModal: React.FC<MovieModalProps> = ({ movie, onClose, onPlay, onToggleMyList, isInMyList }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="bg-zinc-900 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={movie.backdropUrl} alt={movie.title} className="w-full h-56 md:h-96 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
          <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/80 transition-colors">
            X
          </button>
          <div className="absolute bottom-8 left-8">
            <h2 className="text-3xl md:text-5xl font-black text-white text-shadow-lg">{movie.title}</h2>
          </div>
        </div>

        <div className="p-8">
          <p className="text-gray-300 mb-6">{movie.description}</p>
          <div className="flex items-center space-x-4">
            <button
              onClick={onPlay}
              className="flex-grow bg-white text-black font-bold py-3 px-6 rounded-md flex items-center justify-center space-x-2 hover:bg-gray-200 transition-transform duration-200 hover:scale-105"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <span>Play</span>
            </button>
            <button
              onClick={() => onToggleMyList(movie)}
              className="flex-grow bg-zinc-700 text-white font-bold py-3 px-6 rounded-md hover:bg-zinc-600 transition-transform duration-200 hover:scale-105"
            >
              {isInMyList ? 'Remove from My List' : 'Save to My List'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieModal;
