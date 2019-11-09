import { PathsManager } from "./PathsManager";
import { SavedThreadManager } from "./SavedThreadManager";

export module Singletons {
    export var pathsManager = new PathsManager();
    export var savedThreadsManager = new SavedThreadManager(pathsManager);
}