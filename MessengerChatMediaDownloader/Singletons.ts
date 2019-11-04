import { PathsManager } from "./PathsManager";
import { SavedThreadManager } from "./ThreadSavedInfo";

export module Singletons {
    export var pathsManager = new PathsManager();
    export var savedThreadsManager = new SavedThreadManager();
}