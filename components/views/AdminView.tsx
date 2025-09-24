import React, { useState, useRef, ChangeEvent, useMemo, useEffect } from 'react';
import { Movie } from '../../types';

interface AdminViewProps {
  onAddMovie: (movie: Omit<Movie, 'id' | 'watchPercentage'>, category: string) => void;
  onUpdateMovie: (movie: Movie) => void;
  allMovies: Movie[];
  initialMovieToEdit: Movie | null;
  onEditDone: () => void;
  categories: string[];
}

type UploadType = 'movie' | 'season';

interface EpisodeData {
    id: number;
    episodeNumber: number;
    title: string;
    description: string;
    videoUrl: string;
    subtitleUrl?: string;
    audioUrl?: string;
    duration: { hours: number; minutes: number; seconds: number };
}

// --- HELPER FUNCTIONS FOR LINK CORRECTION ---
const isCorrectedGoogleDriveLink = (url: string): boolean => {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname === 'drive.google.com' && parsedUrl.pathname === '/uc' && parsedUrl.searchParams.has('export') && parsedUrl.searchParams.get('export') === 'download' && parsedUrl.searchParams.has('id');
    } catch (e) { return false; }
};

const isCorrectedDropboxLink = (url: string): boolean => {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname === 'dl.dropboxusercontent.com';
    } catch (e) { return false; }
};

const AdminView: React.FC<AdminViewProps> = ({ onAddMovie, onUpdateMovie, allMovies, initialMovieToEdit, onEditDone, categories }) => {
    const [uploadType, setUploadType] = useState<UploadType>('movie');
    const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // --- Shared State ---
    const [isTestingLink, setIsTestingLink] = useState(false);
    const [testResult, setTestResult] = useState<'loading' | 'success' | 'error' | null>(null);
    const [testingUrl, setTestingUrl] = useState('');
    const testVideoRef = useRef<HTMLVideoElement>(null);
    const [linkCorrectionMessage, setLinkCorrectionMessage] = useState('');
    const correctionTimeoutRef = useRef<number | null>(null);

    // --- Movie Form State ---
    const [movieTitle, setMovieTitle] = useState('');
    const [movieDescription, setMovieDescription] = useState('');
    const [movieVideoUrl, setMovieVideoUrl] = useState('');
    const [movieSubtitleUrl, setMovieSubtitleUrl] = useState('');
    const [movieAudioUrl, setMovieAudioUrl] = useState('');
    const [moviePosterUrl, setMoviePosterUrl] = useState('');
    const [movieBackdropUrl, setMovieBackdropUrl] = useState('');
    const [movieDuration, setMovieDuration] = useState({ hours: 0, minutes: 0, seconds: 0});
    const [movieCategory, setMovieCategory] = useState<string>(categories[1] || 'New Movies');
    const [newCategoryName, setNewCategoryName] = useState('');
    const isCreatingNewCategory = movieCategory === 'CREATE_NEW';

    // --- Season Form State ---
    const [showTitle, setShowTitle] = useState('');
    const [seasonNumber, setSeasonNumber] = useState(1);
    const [seasonDescription, setSeasonDescription] = useState('');
    const [seasonPosterUrl, setSeasonPosterUrl] = useState('');
    const [seasonBackdropUrl, setSeasonBackdropUrl] = useState('');
    const [episodes, setEpisodes] = useState<EpisodeData[]>([
        { id: Date.now(), episodeNumber: 1, title: '', description: '', videoUrl: '', subtitleUrl: '', audioUrl: '', duration: { hours: 0, minutes: 0, seconds: 0 } }
    ]);

    const searchResults = useMemo(() => {
        if (!searchQuery) return [];
        const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.title, m])).values());
        return uniqueMovies.filter(movie => movie.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [searchQuery, allMovies]);

    const handleEditSelect = (movie: Movie) => {
        setEditingMovie(movie);
        setSearchQuery('');

        if (movie.seasonNumber && movie.episodeNumber) {
            setUploadType('season');
            alert("Editing individual episodes is not fully supported yet. Populating as a movie.");
            setUploadType('movie');
            setMovieTitle(movie.title);
            setMovieDescription(movie.description);
            setMovieVideoUrl(movie.videoUrl);
            setMovieSubtitleUrl(movie.subtitleUrl || '');
            setMovieAudioUrl(movie.audioUrl || '');
            setMoviePosterUrl(movie.posterUrl);
            setMovieBackdropUrl(movie.backdropUrl);
            setMovieDuration(movie.duration);
        } else {
            setUploadType('movie');
            setMovieTitle(movie.title);
            setMovieDescription(movie.description);
            setMovieVideoUrl(movie.videoUrl);
            setMovieSubtitleUrl(movie.subtitleUrl || '');
            setMovieAudioUrl(movie.audioUrl || '');
            setMoviePosterUrl(movie.posterUrl);
            setMovieBackdropUrl(movie.backdropUrl);
            setMovieDuration(movie.duration);
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (initialMovieToEdit) {
            handleEditSelect(initialMovieToEdit);
            onEditDone();
        }
    }, [initialMovieToEdit, onEditDone]);
    
    const handleAddEpisode = () => {
        const nextEpisodeNumber = episodes.length > 0 ? Math.max(...episodes.map(e => e.episodeNumber)) + 1 : 1;
        setEpisodes([...episodes, {
            id: Date.now(),
            episodeNumber: nextEpisodeNumber,
            title: '', description: '', videoUrl: '', subtitleUrl: '', audioUrl: '', duration: { hours: 0, minutes: 0, seconds: 0 }
        }]);
    };
    
    const handleRemoveEpisode = (id: number) => {
        setEpisodes(episodes.filter(ep => ep.id !== id));
    };
    
    const handleEpisodeChange = <K extends keyof EpisodeData>(id: number, field: K, value: EpisodeData[K]) => {
        setEpisodes(currentEpisodes => currentEpisodes.map(ep => ep.id === id ? { ...ep, [field]: value } : ep));
    };

    const handleEpisodeDurationChange = (id: number, unit: 'hours' | 'minutes' | 'seconds', value: string) => {
        const numValue = parseInt(value, 10) || 0;
        setEpisodes(currentEpisodes => currentEpisodes.map(ep => ep.id === id ? { ...ep, duration: {...ep.duration, [unit]: numValue} } : ep));
    };

    const handleUrlChange = (value: string, setter: (url: string) => void) => {
        let url = value;
        let correctionMade = false;
        let correctionMessage = '';

        if (correctionTimeoutRef.current) clearTimeout(correctionTimeoutRef.current);
        setLinkCorrectionMessage('');

        // Dropbox correction
        if (url.includes('dropbox.com')) {
            try {
                const dropboxUrl = new URL(url);
                if (dropboxUrl.hostname === 'www.dropbox.com') {
                    dropboxUrl.hostname = 'dl.dropboxusercontent.com';
                    dropboxUrl.searchParams.delete('dl');
                    const correctedUrl = dropboxUrl.toString();
                    if (url !== correctedUrl) {
                        url = correctedUrl;
                        correctionMade = true;
                        correctionMessage = "We've auto-corrected your Dropbox link for direct access.";
                    }
                }
            } catch (error) {}
        }
        
        // Google Drive correction
        if (!correctionMade) {
            const driveIdRegex = /(?:drive\.google\.com\/(?:file\/d\/|uc\?id=|open\?id=))([a-zA-Z0-9_-]+)/;
            const match = url.match(driveIdRegex);
            if (match && match[1]) {
                const correctUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
                if (url !== correctUrl) {
                    url = correctUrl;
                    correctionMade = true;
                    correctionMessage = "We've auto-corrected your Google Drive link for playback.";
                }
            }
        }

        setter(url);

        if (correctionMade) {
            setLinkCorrectionMessage(correctionMessage);
            correctionTimeoutRef.current = window.setTimeout(() => setLinkCorrectionMessage(''), 5000);
        }
    };

    const handleTestLink = (url: string) => {
        if (!url) {
          alert('Please enter a link to test.');
          return;
        }
        setTestingUrl(url);
        setTestResult('loading');
        setIsTestingLink(true);
    };

    const closeTestModal = () => {
        if (testVideoRef.current) {
            testVideoRef.current.pause();
            testVideoRef.current.src = '';
        }
        setIsTestingLink(false);
        setTestResult(null);
        setTestingUrl('');
    }
    
    const resetMovieForm = () => {
        setMovieTitle('');
        setMovieDescription('');
        setMovieVideoUrl('');
        setMovieSubtitleUrl('');
        setMovieAudioUrl('');
        setMoviePosterUrl('');
        setMovieBackdropUrl('');
        setMovieDuration({ hours: 0, minutes: 0, seconds: 0 });
        setEditingMovie(null);
        setMovieCategory(categories[1] || 'New Movies');
        setNewCategoryName('');
    };

    const resetSeasonForm = () => {
        setShowTitle('');
        setSeasonNumber(1);
        setSeasonDescription('');
        setSeasonPosterUrl('');
        setSeasonBackdropUrl('');
        setEpisodes([{ id: Date.now(), episodeNumber: 1, title: '', description: '', videoUrl: '', subtitleUrl: '', audioUrl: '', duration: { hours: 0, minutes: 0, seconds: 0 } }]);
        setEditingMovie(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (uploadType === 'movie') {
            const finalCategory = isCreatingNewCategory ? newCategoryName : movieCategory;
            if (!movieTitle || !movieDescription || !movieVideoUrl || !finalCategory) {
                alert('Title, Description, Category, and a Movie Link are required.');
                return;
            }
            if (editingMovie) {
                const updatedMovie: Movie = {
                    ...editingMovie,
                    title: movieTitle,
                    description: movieDescription,
                    videoUrl: movieVideoUrl,
                    subtitleUrl: movieSubtitleUrl,
                    audioUrl: movieAudioUrl,
                    posterUrl: moviePosterUrl,
                    backdropUrl: movieBackdropUrl,
                    duration: movieDuration,
                };
                onUpdateMovie(updatedMovie);
            } else {
                 const posterUrl = moviePosterUrl || `https://picsum.photos/seed/${encodeURIComponent(movieTitle)}/400/600`;
                const backdropUrl = movieBackdropUrl || `https://picsum.photos/seed/${encodeURIComponent(movieTitle)}bg/1200/675`;
                onAddMovie({ title: movieTitle, description: movieDescription, posterUrl, backdropUrl, videoUrl: movieVideoUrl, subtitleUrl: movieSubtitleUrl, audioUrl: movieAudioUrl, duration: movieDuration }, finalCategory);
            }
            resetMovieForm();
        } else { // Season
             if (!showTitle || !seasonNumber) {
                alert('Show Title and Season Number are required.');
                return;
            }
            if (episodes.some(ep => !ep.title || !ep.videoUrl || !ep.episodeNumber)) {
                alert('Each episode must have an Episode Number, Title, and Video Link.');
                return;
            }
             // NOTE: Season editing is not implemented in this pass.
            if (editingMovie) {
                alert("Updating entire seasons is not supported yet.");
                return;
            }

            const posterUrl = seasonPosterUrl || `https://picsum.photos/seed/${encodeURIComponent(showTitle)}S${seasonNumber}/400/600`;
            const backdropUrl = seasonBackdropUrl || `https://picsum.photos/seed/${encodeURIComponent(showTitle)}S${seasonNumber}bg/1200/675`;
            
            episodes.forEach(ep => {
                onAddMovie({
                    title: showTitle,
                    description: ep.description || seasonDescription,
                    posterUrl,
                    backdropUrl,
                    videoUrl: ep.videoUrl,
                    subtitleUrl: ep.subtitleUrl,
                    audioUrl: ep.audioUrl,
                    duration: ep.duration,
                    seasonNumber: seasonNumber,
                    episodeNumber: ep.episodeNumber,
                    episodeTitle: ep.title,
                }, 'TV Shows'); // Seasons always go to TV Shows category
            });
            resetSeasonForm();
        }
    };
    
    // --- Reusable UI Components ---
    const UrlInput: React.FC<{id: string; label: string; value: string; onChange: (val: string) => void; required?: boolean; hasTest?: boolean; placeholder?: string}> = 
    ({ id, label, value, onChange, required = false, hasTest = false, placeholder }) => (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-zinc-300 mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
            <div className="flex items-end space-x-2">
                <input 
                    type="url" 
                    id={id} 
                    value={value} 
                    onChange={(e) => handleUrlChange(e.target.value, onChange)} 
                    placeholder={placeholder} 
                    className="flex-grow w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" 
                    required={required} 
                />
                {hasTest && <button type="button" onClick={() => handleTestLink(value)} className="flex-shrink-0 bg-zinc-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-zinc-500 transition-colors">Test Link</button>}
            </div>
        </div>
    );
    
    const isCorrectedCloudLink = isCorrectedGoogleDriveLink(testingUrl) || isCorrectedDropboxLink(testingUrl);

    return (
        <>
            <div className="container mx-auto px-6 py-8 flex flex-col items-center">
                <div className="w-full max-w-4xl">
                    <h1 className="text-4xl font-bold mb-2 text-center">Admin Panel</h1>
                    <p className="text-zinc-400 mb-8 text-center">{editingMovie ? `Editing "${editingMovie.title}"` : 'Add new content to the Thelden library.'}</p>
                    
                    <div className="flex justify-center mb-8">
                      <div className="bg-zinc-800 p-1 rounded-full flex items-center space-x-1">
                          <button onClick={() => { setUploadType('movie'); resetMovieForm(); resetSeasonForm(); }} className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${uploadType === 'movie' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Movie</button>
                          <button onClick={() => { setUploadType('season'); resetMovieForm(); resetSeasonForm(); }} className={`px-6 py-2 text-sm font-semibold rounded-full transition-colors ${uploadType === 'season' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>TV Show Season</button>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                        {/* MOVIE UPLOAD FORM */}
                        {uploadType === 'movie' && (
                            <>
                                <div>
                                    <label htmlFor="movieTitle" className="block text-sm font-medium text-zinc-300 mb-2">Movie Title <span className="text-red-500">*</span></label>
                                    <input type="text" id="movieTitle" value={movieTitle} onChange={(e) => setMovieTitle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="movieCategory" className="block text-sm font-medium text-zinc-300 mb-2">Category <span className="text-red-500">*</span></label>
                                        <select id="movieCategory" value={movieCategory} onChange={e => setMovieCategory(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" required>
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            <option value="CREATE_NEW" className="font-bold text-red-400">-- Create New Category --</option>
                                        </select>
                                    </div>
                                    {isCreatingNewCategory && (
                                        <div className="fade-in">
                                            <label htmlFor="newCategoryName" className="block text-sm font-medium text-zinc-300 mb-2">New Category Name <span className="text-red-500">*</span></label>
                                            <input type="text" id="newCategoryName" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" required={isCreatingNewCategory} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="movieDescription" className="block text-sm font-medium text-zinc-300 mb-2">Description <span className="text-red-500">*</span></label>
                                    <textarea id="movieDescription" value={movieDescription} onChange={(e) => setMovieDescription(e.target.value)} rows={4} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" required />
                                </div>
                                
                                <UrlInput id="movieVideoUrl" label="Movie Cloud Link (Google Drive, Dropbox)" value={movieVideoUrl} onChange={setMovieVideoUrl} required hasTest placeholder="Paste any Google Drive or Dropbox share link..." />
                                <p className="text-xs text-zinc-400 -mt-4 h-4">{linkCorrectionMessage && <span className="text-blue-400 fade-in">{linkCorrectionMessage}</span>}</p>
                                <UrlInput id="movieSubtitleUrl" label="Subtitle Link (Dropbox, .vtt file)" value={movieSubtitleUrl} onChange={setMovieSubtitleUrl} hasTest placeholder="Optional: Paste Dropbox link to .vtt file..." />
                                <UrlInput id="movieAudioUrl" label="Alternate Audio Link (Dropbox)" value={movieAudioUrl} onChange={setMovieAudioUrl} hasTest placeholder="Optional: Paste Dropbox link to audio file..." />
                                <UrlInput id="moviePosterUrl" label="Poster Image Link (Dropbox)" value={moviePosterUrl} onChange={setMoviePosterUrl} placeholder="Optional: Paste Dropbox link to image..." />
                                <UrlInput id="movieBackdropUrl" label="Backdrop Image Link (Dropbox)" value={movieBackdropUrl} onChange={setMovieBackdropUrl} placeholder="Optional: Paste Dropbox link to image..." />
                                
                                <div>
                                    <label htmlFor="movieDurationHours" className="block text-sm font-medium text-zinc-300 mb-2">Duration <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-3 gap-4">
                                        <input type="number" id="movieDurationHours" placeholder="Hours" value={movieDuration.hours || ''} onChange={e => setMovieDuration(d => ({...d, hours: parseInt(e.target.value) || 0}))} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                        <input type="number" placeholder="Minutes" value={movieDuration.minutes || ''} onChange={e => setMovieDuration(d => ({...d, minutes: parseInt(e.target.value) || 0}))} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                        <input type="number" placeholder="Seconds" value={movieDuration.seconds || ''} onChange={e => setMovieDuration(d => ({...d, seconds: parseInt(e.target.value) || 0}))} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                    </div>
                                </div>
                                <div className="flex space-x-4">
                                <button type="submit" className="flex-grow bg-red-600 text-white font-bold py-3 rounded-md hover:bg-red-700 transition-colors">
                                    {editingMovie ? 'Update Movie' : 'Add Movie'}
                                </button>
                                {editingMovie && (
                                    <button type="button" onClick={resetMovieForm} className="flex-shrink-0 bg-zinc-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-zinc-500 transition-colors">
                                        Cancel Edit
                                    </button>
                                )}
                                </div>
                            </>
                        )}
                        
                        {/* SEASON UPLOAD FORM */}
                        {uploadType === 'season' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <label htmlFor="showTitle" className="block text-sm font-medium text-zinc-300 mb-2">Show Title <span className="text-red-500">*</span></label>
                                        <input type="text" id="showTitle" value={showTitle} onChange={e => setShowTitle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" required />
                                    </div>
                                    <div>
                                        <label htmlFor="seasonNumber" className="block text-sm font-medium text-zinc-300 mb-2">Season Number <span className="text-red-500">*</span></label>
                                        <input type="number" id="seasonNumber" value={seasonNumber || ''} onChange={e => setSeasonNumber(parseInt(e.target.value) || 1)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" required />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="seasonDescription" className="block text-sm font-medium text-zinc-300 mb-2">Season Description</label>
                                    <textarea id="seasonDescription" value={seasonDescription} onChange={(e) => setSeasonDescription(e.target.value)} rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                </div>
                                <UrlInput id="seasonPosterUrl" label="Season Poster Link (Dropbox)" value={seasonPosterUrl} onChange={setSeasonPosterUrl} placeholder="Optional: Paste Dropbox link to image..." />
                                <UrlInput id="seasonBackdropUrl" label="Season Backdrop Link (Dropbox)" value={seasonBackdropUrl} onChange={setSeasonBackdropUrl} placeholder="Optional: Paste Dropbox link to image..." />

                                <div className="border-t border-zinc-700 pt-6 space-y-4">
                                    <h3 className="text-xl font-bold text-white">Episodes</h3>
                                    {episodes.map((ep, index) => (
                                        <div key={ep.id} className="bg-zinc-800/50 p-4 rounded-lg space-y-4 border border-zinc-700">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <label htmlFor={`epNumber-${ep.id}`} className="text-sm font-medium text-zinc-300">Ep.</label>
                                                    <input type="number" id={`epNumber-${ep.id}`} value={ep.episodeNumber || ''} onChange={e => handleEpisodeChange(ep.id, 'episodeNumber', parseInt(e.target.value))} className="w-20 bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                                    <input type="text" placeholder="Episode Title" value={ep.title} onChange={e => handleEpisodeChange(ep.id, 'title', e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-red-600" required/>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveEpisode(ep.id)} className="text-zinc-400 hover:text-red-500 transition-colors">&times;</button>
                                            </div>
                                            <div>
                                                <textarea placeholder="Episode Description (optional)" value={ep.description} onChange={e => handleEpisodeChange(ep.id, 'description', e.target.value)} rows={2} className="w-full text-sm bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                            </div>
                                            
                                            <UrlInput id={`epVideoUrl-${ep.id}`} label="" value={ep.videoUrl || ''} onChange={(url) => handleEpisodeChange(ep.id, 'videoUrl', url)} required hasTest placeholder="Episode Video Link (Google Drive, etc.)" />
                                            <UrlInput id={`epSubtitleUrl-${ep.id}`} label="" value={ep.subtitleUrl || ''} onChange={(url) => handleEpisodeChange(ep.id, 'subtitleUrl', url)} hasTest placeholder="Episode Subtitle Link (Optional)" />
                                            <UrlInput id={`epAudioUrl-${ep.id}`} label="" value={ep.audioUrl || ''} onChange={(url) => handleEpisodeChange(ep.id, 'audioUrl', url)} hasTest placeholder="Episode Audio Link (Optional)" />

                                            <div>
                                                <label htmlFor={`epDurationHours-${ep.id}`} className="block text-xs font-medium text-zinc-400 mb-1">Duration</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <input type="number" id={`epDurationHours-${ep.id}`} placeholder="H" value={ep.duration.hours || ''} onChange={e => handleEpisodeDurationChange(ep.id, 'hours', e.target.value)} className="w-full text-sm bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                                    <input type="number" placeholder="M" value={ep.duration.minutes || ''} onChange={e => handleEpisodeDurationChange(ep.id, 'minutes', e.target.value)} className="w-full text-sm bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                                    <input type="number" placeholder="S" value={ep.duration.seconds || ''} onChange={e => handleEpisodeDurationChange(ep.id, 'seconds', e.target.value)} className="w-full text-sm bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 focus:outline-none focus:ring-2 focus:ring-red-600" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={handleAddEpisode} className="w-full bg-zinc-700 text-zinc-300 font-semibold py-2 rounded-md hover:bg-zinc-600 hover:text-white transition-colors">Add Episode</button>
                                </div>
                                <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-md hover:bg-red-700 transition-colors">Add Season</button>
                            </>
                        )}
                    </form>
                </div>
                
                <div className="w-full max-w-4xl mt-12">
                    <div className="glass-card p-8">
                        <h2 className="text-2xl font-bold mb-4 text-white">Edit Existing Content</h2>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for a movie to edit..."
                            className="w-full bg-zinc-800 border-2 border-zinc-700 text-white placeholder-zinc-500 rounded-lg py-2 px-4 mb-4 focus:outline-none focus:border-red-600 transition-colors"
                        />
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                            {searchResults.map(movie => (
                                <div key={movie.id} onClick={() => handleEditSelect(movie)} className="flex items-center space-x-4 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/70 cursor-pointer transition-colors">
                                    <img src={movie.posterUrl} alt={movie.title} className="w-10 h-14 object-cover rounded" />
                                    <p className="font-semibold">{movie.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

             {isTestingLink && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 fade-in" onClick={closeTestModal}>
                    <div className="bg-zinc-800 p-6 rounded-lg w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">Testing Video Link</h3>
                        {testResult === 'loading' && <div className="flex items-center space-x-2 text-zinc-300"><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Attempting to load...</span></div>}
                        {testResult === 'error' && (
                            <>
                                {isCorrectedCloudLink ? (
                                    <div className="text-red-400 p-4 bg-red-900/40 border border-red-700/50 rounded-lg space-y-3">
                                        <div className="flex items-start space-x-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><div><h4 className="font-bold text-lg">Playback Failed</h4><p className="text-sm text-zinc-300 mt-1">We formatted this into a direct link, but it still won't play. This is likely a permissions issue.</p></div></div>
                                        <div className="pt-3 border-t border-red-700/30"><p className="font-bold text-yellow-400">💡 How to Fix:</p><p className="text-sm text-zinc-200 mt-1">Please go to Google Drive or Dropbox and ensure the file's sharing setting is <strong className="text-white">"Anyone with the link"</strong>.</p></div>
                                    </div>
                                ) : (
                                  <div className="text-red-400 p-4 bg-red-900/40 border border-red-700/50 rounded-lg space-y-4">
                                      <div className="flex items-start space-x-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><div><h4 className="font-bold text-lg">Playback Failed: Not a Direct Link</h4><p className="text-sm text-zinc-300 mt-1">This doesn't seem to be a standard share link that we can auto-correct, or it points to a preview page instead of a video file.</p></div></div>
                                      <div className="pt-3 border-t border-red-700/30"><p className="font-bold text-lg text-yellow-400">💡 What To Do</p><p className="text-sm text-zinc-200">Please paste the standard "share" link from Google Drive or Dropbox, and our app will try to correct it for you.</p></div>
                                  </div>
                                )}
                            </>
                        )}
                        {testResult === 'success' && <div className="text-green-400 p-3 bg-green-900/50 border border-green-800 rounded-md"><p className="font-semibold">Success! Video is playable.</p></div>}
                        <video ref={testVideoRef} key={testingUrl} src={testingUrl} controls className={`w-full h-auto mt-4 rounded-md bg-black ${testResult === 'loading' || testResult === 'error' ? 'hidden' : 'block'}`} onCanPlay={() => setTestResult('success')} onError={() => setTestResult('error')} autoPlay />
                        <button onClick={closeTestModal} className="mt-6 w-full bg-zinc-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-zinc-500 transition-colors">Close</button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminView;